"""Consulta citas en servicio-citas (el catálogo no lee sus tablas directamente)."""

import logging

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

log = logging.getLogger(__name__)

_http = httpx.Client(
    base_url=settings.citas_service_url,
    headers={"X-Internal-Key": settings.internal_api_key},
    timeout=5.0,
    limits=httpx.Limits(keepalive_expiry=2.0),  # menor que el de uvicorn (5 s)
)


def obtener_cita(cita_id: int) -> dict:
    """Devuelve {id, usuario_id, estado, nombre_cliente, productos: [{producto_id, nombre}]}."""
    try:
        r = _http.get(f"/citas/interno/{cita_id}")
        if r.status_code == 404:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada")
        r.raise_for_status()
    except httpx.HTTPError as exc:
        log.warning("No se pudo consultar la cita %s: %s", cita_id, exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "No se pudo consultar la cita, intenta más tarde"
        )
    return r.json()
