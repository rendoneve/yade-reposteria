import threading
import time
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.actividad import registrar_actividad
from app.core.database import get_db, leer
from app.core.security import Admin
from app.models import Horario
from app.schemas import HorarioIn, HorarioOut, NegocioOut, NegocioUpdate

router = APIRouter(tags=["Negocio"])
DB = Annotated[Session, Depends(get_db)]

# /negocio se pide en cada visita al sitio y casi nunca cambia: se guarda en memoria y
# se reemplaza en cuanto el administrador guarda cambios. El TTL cubre el caso de varios procesos.
TTL_SEGUNDOS = 60.0
_cache: tuple[float, NegocioOut] | None = None
_candado = threading.Lock()


def _out(db: Session) -> NegocioOut:
    out = NegocioOut.model_validate(repo.obtener_negocio(db))
    out.horarios = [HorarioOut.model_validate(h) for h in repo.listar_horarios(db)]
    return out


def _guardar_cache(out: NegocioOut) -> NegocioOut:
    global _cache
    with _candado:
        _cache = (time.monotonic(), out)
    return out


def _negocio_en_cache() -> NegocioOut:
    guardado = _cache
    if guardado and time.monotonic() - guardado[0] < TTL_SEGUNDOS:
        return guardado[1]
    return _guardar_cache(leer(_out))


@router.get("/negocio", response_model=NegocioOut)
def ver_negocio():
    """Contenido público del sitio: banner, textos, WhatsApp, ubicación y horarios."""
    return _negocio_en_cache()


@router.patch("/negocio", response_model=NegocioOut)
def editar_negocio(datos: NegocioUpdate, admin: Admin, db: DB, tareas: BackgroundTasks):
    negocio = repo.obtener_negocio(db)
    cambios = datos.model_dump(exclude_unset=True)
    for campo, valor in cambios.items():
        setattr(negocio, campo, valor)
    db.commit()
    out = _guardar_cache(_out(db))
    if cambios:
        tareas.add_task(
            registrar_actividad,
            admin.username,
            f"Modificó la información del negocio ({', '.join(cambios)})",
            "modificacion",
        )
    return out


@router.get("/horarios", response_model=list[HorarioOut])
def ver_horarios():
    return _negocio_en_cache().horarios


@router.put("/horarios", response_model=list[HorarioOut])
def guardar_horarios(datos: list[HorarioIn], admin: Admin, db: DB, tareas: BackgroundTasks):
    """Recibe uno o varios días y los guarda (los días que no mandes no cambian)."""
    dias = [h.dia_semana for h in datos]
    if len(dias) != len(set(dias)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Hay días repetidos")
    for h in datos:
        db.merge(Horario(**h.model_dump()))
    db.commit()
    out = _guardar_cache(_out(db))
    tareas.add_task(registrar_actividad, admin.username, "Modificó los horarios", "modificacion")
    return out.horarios
