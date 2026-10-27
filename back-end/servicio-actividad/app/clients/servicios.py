"""Pide datos a otros servicios por HTTP (nunca se leen sus tablas directamente)."""

import httpx

from app.core.config import settings


class ServicioNoDisponible(Exception):
    pass


async def _total(cliente: httpx.AsyncClient, url: str, token: str) -> int:
    try:
        r = await cliente.get(url, headers={"Authorization": f"Bearer {token}"})
    except httpx.TimeoutException:
        raise ServicioNoDisponible("tardó demasiado en responder")
    except httpx.HTTPError:
        raise ServicioNoDisponible("no está disponible")
    if r.status_code != 200:
        raise ServicioNoDisponible(f"respondió con error {r.status_code}")
    return int(r.json()["total"])


async def total_productos(cliente: httpx.AsyncClient, token: str) -> int:
    return await _total(cliente, f"{settings.catalogo_service_url}/productos/count", token)


async def total_citas_proximas(cliente: httpx.AsyncClient, token: str) -> int:
    return await _total(cliente, f"{settings.citas_service_url}/citas/proximas/count", token)


async def total_citas_terminadas(cliente: httpx.AsyncClient, token: str) -> int:
    return await _total(cliente, f"{settings.citas_service_url}/citas/terminadas/count", token)
