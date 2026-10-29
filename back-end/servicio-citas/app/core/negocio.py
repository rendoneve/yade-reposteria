"""Horarios del negocio, pedidos a servicio-negocio por HTTP y guardados un minuto en memoria.

Si servicio-negocio no responde se usan los últimos horarios conocidos; si nunca se pudieron
leer, devuelve None y la cita se acepta sin validar el horario (se avisa en el log).
"""

import logging
import threading
import time
from datetime import time as Hora

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

TTL_SEGUNDOS = 60.0
_http = httpx.Client(
    base_url=settings.negocio_service_url,
    timeout=3.0,
    limits=httpx.Limits(keepalive_expiry=2.0),  # menor que el de uvicorn (5 s)
    transport=httpx.HTTPTransport(retries=1),
)
_candado = threading.Lock()
_cache: tuple[float, dict[int, tuple[Hora, Hora] | None]] | None = None


def _leer() -> dict[int, tuple[Hora, Hora] | None]:
    r = _http.get("/horarios")
    r.raise_for_status()
    horarios: dict[int, tuple[Hora, Hora] | None] = {}
    for h in r.json():
        if h["cerrado"] or not h["abre"] or not h["cierra"]:
            horarios[h["dia_semana"]] = None
        else:
            horarios[h["dia_semana"]] = (Hora.fromisoformat(h["abre"]), Hora.fromisoformat(h["cierra"]))
    return horarios


def horarios() -> dict[int, tuple[Hora, Hora] | None] | None:
    """{dia_semana (0 = domingo): (abre, cierra) o None si cierra}.

    Devuelve None si los horarios no se conocen o si no se han configurado (todos los días
    cerrados es como viene la base de datos nueva): en ese caso no se restringe la hora."""
    global _cache
    ahora = time.monotonic()
    with _candado:
        guardado = _cache
    if guardado is None or ahora - guardado[0] >= TTL_SEGUNDOS:
        try:
            guardado = (ahora, _leer())
            with _candado:
                _cache = guardado
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            log.warning("No se pudieron leer los horarios del negocio: %s", exc)
            if guardado is None:
                return None
    datos = guardado[1]
    return datos if any(v is not None for v in datos.values()) else None
