from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.database import get_db
from app.core.security import Admin, require_internal_key
from app.schemas import ActividadIn, ActividadOut

router = APIRouter(prefix="/actividades", tags=["Actividades"])
DB = Annotated[Session, Depends(get_db)]


@router.post(
    "",
    response_model=ActividadOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_internal_key)],
)
def registrar(datos: ActividadIn, db: DB):
    """Solo para otros servicios (header X-Internal-Key). El gateway no lo deja pasar."""
    return repo.crear(db, datos.persona, datos.nombre, datos.tipo)


@router.get("", response_model=list[ActividadOut])
def historial(
    admin: Admin,
    db: DB,
    tipo: str | None = None,
    persona: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    return repo.listar(db, tipo, persona, limit, offset)
