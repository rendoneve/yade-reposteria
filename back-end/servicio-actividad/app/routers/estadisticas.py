import asyncio

from fastapi import APIRouter, Query, Request
from fastapi.concurrency import run_in_threadpool
from app import repository as repo
from app.clients import servicios
from app.core.database import leer
from app.core.security import Admin
from app.schemas import ActividadOut, EstadisticasOut

router = APIRouter(prefix="/estadisticas", tags=["Estadísticas"])


def _listar_actividad_con_reintento(recientes: int):
    return leer(lambda db: repo.listar(db, None, None, recientes, 0))


@router.get("", response_model=EstadisticasOut)
async def estadisticas(
    request: Request,
    admin: Admin,
    recientes: int = Query(default=10, ge=1, le=50),
):
    """Datos del panel. Si un servicio falla, ese dato viene en null y el motivo en `errores`."""
    productos, citas, actividad = await asyncio.gather(
        servicios.resumen_productos(request.app.state.http, admin.token),
        servicios.resumen_citas(request.app.state.http, admin.token),
        run_in_threadpool(_listar_actividad_con_reintento, recientes),
        return_exceptions=True,
    )

    errores: dict[str, str] = {}
    if isinstance(productos, Exception):
        errores["productos"] = f"servicio-catalogo {productos}"
        productos = None
    if isinstance(citas, Exception):
        errores["citas"] = f"servicio-citas {citas}"
        citas = None
    if isinstance(actividad, Exception):
        errores["actividad_reciente"] = "no se pudo leer el historial"
        actividad = []

    return EstadisticasOut(
        productos_en_catalogo=productos["total"] if productos else None,
        inventario=productos,
        citas_proximas=citas["citas_proximas"] if citas else None,
        citas_terminadas=citas["citas_terminadas"] if citas else None,
        citas_siguientes=citas["siguientes"] if citas else [],
        actividad_reciente=[ActividadOut.model_validate(a) for a in actividad],
        errores=errores,
    )
