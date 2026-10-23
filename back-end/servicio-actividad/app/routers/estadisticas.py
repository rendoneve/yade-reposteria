import asyncio
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.concurrency import run_in_threadpool
from sqlalchemy.orm import Session

from app import repository as repo
from app.clients import servicios
from app.core.config import settings
from app.core.database import get_db
from app.core.security import Admin
from app.schemas import ActividadOut, EstadisticasOut

router = APIRouter(prefix="/estadisticas", tags=["Estadísticas"])


@router.get("", response_model=EstadisticasOut)
async def estadisticas(
    admin: Admin,
    db: Annotated[Session, Depends(get_db)],
    recientes: int = Query(default=10, ge=1, le=50),
):
    """Datos del panel. Si un servicio falla, ese dato viene en null y el motivo en `errores`."""
    async with httpx.AsyncClient(timeout=settings.http_timeout) as cliente:
        productos, citas, actividad = await asyncio.gather(
            servicios.total_productos(cliente, admin.token),
            servicios.total_citas_proximas(cliente, admin.token),
            run_in_threadpool(repo.listar, db, None, None, recientes, 0),
            return_exceptions=True,
        )

    errores: dict[str, str] = {}
    if isinstance(productos, Exception):
        errores["productos_en_catalogo"] = f"servicio-catalogo {productos}"
        productos = None
    if isinstance(citas, Exception):
        errores["citas_proximas"] = f"servicio-citas {citas}"
        citas = None
    if isinstance(actividad, Exception):
        errores["actividad_reciente"] = "no se pudo leer el historial"
        actividad = []

    return EstadisticasOut(
        productos_en_catalogo=productos,
        citas_proximas=citas,
        actividad_reciente=[ActividadOut.model_validate(a) for a in actividad],
        errores=errores,
    )
