"""Pide datos a otros servicios por HTTP (nunca se leen sus tablas directamente)."""

import asyncio

import httpx

from app.core.config import settings


class ServicioNoDisponible(Exception):
    pass


async def resumen_citas(cliente: httpx.AsyncClient, token: str) -> dict:
    return await _resumen(cliente, f"{settings.citas_service_url}/citas/resumen", token)


async def resumen_productos(cliente: httpx.AsyncClient, token: str) -> dict:
    return await _resumen(cliente, f"{settings.catalogo_service_url}/productos/resumen", token)


async def _resumen(cliente: httpx.AsyncClient, url: str, token: str) -> dict:
    """Reintenta una vez los fallos 5xx transitorios de Neon al despertar."""
    for intento in range(2):
        try:
            r = await cliente.get(url, headers={"Authorization": f"Bearer {token}"})
        except httpx.TimeoutException:
            if intento == 0:
                await asyncio.sleep(0.2)
                continue
            raise ServicioNoDisponible("tardó demasiado en responder")
        except httpx.HTTPError:
            if intento == 0:
                await asyncio.sleep(0.2)
                continue
            raise ServicioNoDisponible("no está disponible")
        if r.status_code >= 500 and intento == 0:
            await asyncio.sleep(0.2)
            continue
        if r.status_code != 200:
            raise ServicioNoDisponible(f"respondió con error {r.status_code}")
        return r.json()
    raise ServicioNoDisponible("no está disponible")
