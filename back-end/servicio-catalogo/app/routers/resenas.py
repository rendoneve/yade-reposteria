from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.actividad import registrar_actividad
from app.core.database import get_db
from app.core.security import Admin
from app.models import Producto, Resena
from app.schemas import ResenaIn, ResenaOut, ResenaUpdate

router = APIRouter(prefix="/resenas", tags=["Reseñas"])
DB = Annotated[Session, Depends(get_db)]


def _out(r: Resena) -> ResenaOut:
    out = ResenaOut.model_validate(r)
    out.producto_nombre = r.producto.nombre if r.producto else None
    return out


def _obtener_o_404(db: Session, resena_id: int) -> Resena:
    r = db.get(Resena, resena_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reseña no encontrada")
    return r


def _validar_producto(db: Session, producto_id: int) -> None:
    if not db.get(Producto, producto_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "El producto no existe")


@router.get("", response_model=list[ResenaOut])
def listar_resenas(
    db: DB,
    producto_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return [_out(r) for r in repo.listar_resenas(db, producto_id, limit, offset)]


@router.get("/{resena_id}", response_model=ResenaOut)
def obtener_resena(resena_id: int, db: DB):
    return _out(_obtener_o_404(db, resena_id))


@router.post("", response_model=ResenaOut, status_code=status.HTTP_201_CREATED)
def crear_resena(datos: ResenaIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    _validar_producto(db, datos.producto_id)
    r = Resena(**datos.model_dump(exclude_none=True))
    db.add(r)
    db.commit()
    db.refresh(r)
    tareas.add_task(
        registrar_actividad, admin.username, f"Nueva reseña de {r.nombre_cliente}", "nuevo"
    )
    return _out(r)


@router.patch("/{resena_id}", response_model=ResenaOut)
def editar_resena(resena_id: int, datos: ResenaUpdate, admin: Admin, db: DB, tareas: BackgroundTasks):
    r = _obtener_o_404(db, resena_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    if "producto_id" in cambios:
        _validar_producto(db, cambios["producto_id"])
    for campo, valor in cambios.items():
        setattr(r, campo, valor)
    db.commit()
    db.refresh(r)
    tareas.add_task(
        registrar_actividad, admin.username, f"Modificó la reseña de {r.nombre_cliente}", "modificacion"
    )
    return _out(r)


@router.delete("/{resena_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_resena(resena_id: int, admin: Admin, db: DB, tareas: BackgroundTasks):
    r = _obtener_o_404(db, resena_id)
    nombre = r.nombre_cliente
    db.delete(r)
    db.commit()
    tareas.add_task(
        registrar_actividad, admin.username, f"Eliminó la reseña de {nombre}", "eliminacion"
    )
