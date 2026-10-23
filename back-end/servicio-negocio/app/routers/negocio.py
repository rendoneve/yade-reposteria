from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.actividad import registrar_actividad
from app.core.database import get_db
from app.core.security import Admin
from app.models import Horario
from app.schemas import HorarioIn, HorarioOut, NegocioOut, NegocioUpdate

router = APIRouter(tags=["Negocio"])
DB = Annotated[Session, Depends(get_db)]


def _out(db: Session) -> NegocioOut:
    out = NegocioOut.model_validate(repo.obtener_negocio(db))
    out.horarios = [HorarioOut.model_validate(h) for h in repo.listar_horarios(db)]
    return out


@router.get("/negocio", response_model=NegocioOut)
def ver_negocio(db: DB):
    """Contenido público del sitio: banner, textos, WhatsApp, ubicación y horarios."""
    return _out(db)


@router.patch("/negocio", response_model=NegocioOut)
def editar_negocio(datos: NegocioUpdate, admin: Admin, db: DB, tareas: BackgroundTasks):
    negocio = repo.obtener_negocio(db)
    cambios = datos.model_dump(exclude_unset=True)
    for campo, valor in cambios.items():
        setattr(negocio, campo, valor)
    db.commit()
    if cambios:
        tareas.add_task(
            registrar_actividad,
            admin.username,
            f"Modificó la información del negocio ({', '.join(cambios)})",
            "modificacion",
        )
    return _out(db)


@router.get("/horarios", response_model=list[HorarioOut])
def ver_horarios(db: DB):
    return repo.listar_horarios(db)


@router.put("/horarios", response_model=list[HorarioOut])
def guardar_horarios(datos: list[HorarioIn], admin: Admin, db: DB, tareas: BackgroundTasks):
    """Recibe uno o varios días y los guarda (los días que no mandes no cambian)."""
    dias = [h.dia_semana for h in datos]
    if len(dias) != len(set(dias)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Hay días repetidos")
    for h in datos:
        db.merge(Horario(**h.model_dump()))
    db.commit()
    tareas.add_task(registrar_actividad, admin.username, "Modificó los horarios", "modificacion")
    return repo.listar_horarios(db)
