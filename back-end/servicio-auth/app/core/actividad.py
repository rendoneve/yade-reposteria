"""Cliente para registrar movimientos en servicio-actividad.

Se usa con BackgroundTasks: la respuesta al usuario no espera a que se registre,
y si servicio-actividad está caído solo se escribe un aviso en el log.
El cliente HTTP se reutiliza (keep-alive): no abre una conexión nueva por cada movimiento.
"""

import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)

_http = httpx.Client(
    base_url=settings.actividad_service_url,
    headers={"X-Internal-Key": settings.internal_api_key},
    timeout=3.0,
)


def registrar_actividad(persona: str, nombre: str, tipo: str) -> None:
    try:
        r = _http.post("/actividades", json={"persona": persona, "nombre": nombre, "tipo": tipo})
        r.raise_for_status()
    except httpx.HTTPError as exc:
        log.warning("No se pudo registrar la actividad '%s': %s", nombre, exc)
