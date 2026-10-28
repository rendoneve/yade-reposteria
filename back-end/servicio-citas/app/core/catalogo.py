"""Consulta productos en servicio-catalogo (las citas no leen sus tablas directamente)."""

import logging

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

log = logging.getLogger(__name__)


def nombres_de_productos(ids: list[int]) -> dict[int, str]:
    """Devuelve {id: nombre} de cada producto. Si alguno no existe responde 422."""
    nombres: dict[int, str] = {}
    try:
        with httpx.Client(base_url=settings.catalogo_service_url, timeout=5.0) as cliente:
            for producto_id in ids:
                r = cliente.get(f"/productos/{producto_id}")
                if r.status_code == 404:
                    raise HTTPException(
                        status.HTTP_422_UNPROCESSABLE_CONTENT, f"El producto {producto_id} no existe"
                    )
                r.raise_for_status()
                nombres[producto_id] = r.json()["nombre"]
    except httpx.HTTPError as exc:
        log.warning("No se pudieron consultar los productos %s: %s", ids, exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "No se pudo consultar el catálogo, intenta más tarde"
        )
    return nombres
