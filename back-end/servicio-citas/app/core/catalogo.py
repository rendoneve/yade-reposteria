"""Consulta productos en servicio-catalogo (las citas no leen sus tablas directamente)."""

import logging

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

log = logging.getLogger(__name__)


def nombres_de_productos(ids: list[int]) -> dict[int, str]:
    """Devuelve {id: nombre} de cada producto. Si alguno no existe responde 422."""
    if not ids:
        return {}
    try:
        with httpx.Client(base_url=settings.catalogo_service_url, timeout=5.0) as cliente:
            r = cliente.get("/productos", params=[("ids", str(i)) for i in ids])
            r.raise_for_status()
            productos = r.json()
    except httpx.HTTPError as exc:
        log.warning("No se pudieron consultar los productos %s: %s", ids, exc)
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "No se pudo consultar el catálogo, intenta más tarde"
        )
    nombres = {int(p["id"]): p["nombre"] for p in productos}
    faltan = [i for i in ids if i not in nombres]
    if faltan:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Producto(s) que no existen: {', '.join(map(str, faltan))}",
        )
    return nombres
