"""Cliente para registrar movimientos en servicio-actividad.

Se usa con BackgroundTasks: la respuesta al usuario no espera a que se registre,
y si servicio-actividad está caído solo se escribe un aviso en el log.
"""

import logging

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


def registrar_actividad(persona: str, nombre: str, tipo: str) -> None:
    try:
        r = httpx.post(
            f"{settings.actividad_service_url}/actividades",
            json={"persona": persona, "nombre": nombre, "tipo": tipo},
            headers={"X-Internal-Key": settings.internal_api_key},
            timeout=3.0,
        )
        r.raise_for_status()
    except httpx.HTTPError as exc:
        log.warning("No se pudo registrar la actividad '%s': %s", nombre, exc)
