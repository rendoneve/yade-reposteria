from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.actividad import registrar_actividad
from app.core.citas import obtener_cita
from app.core.database import get_db
from app.core.security import Admin, UsuarioActual
from app.models import Producto, Resena
from app.schemas import MiResenaIn, ResenaIn, ResenaOut, ResenaUpdate

router = APIRouter(prefix="/resenas", tags=["Reseñas"])
DB = Annotated[Session, Depends(get_db)]


def _obtener_o_404(db: Session, resena_id: int) -> Resena:
    r = db.get(Resena, resena_id)
    if not r:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Reseña no encontrada")
    return r


def _productos(db: Session, ids: list[int]) -> list[Producto]:
    ids = list(dict.fromkeys(ids))
    productos = repo.productos_por_id(db, ids)
    faltan = sorted(set(ids) - {p.id for p in productos})
    if faltan:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Producto(s) que no existen: {', '.join(map(str, faltan))}",
        )
    return productos


@router.get("", response_model=list[ResenaOut])
def listar_resenas(
    db: DB,
    producto_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return repo.listar_resenas(db, producto_id, limit=limit, offset=offset)


# ---------- Cliente con cuenta (van antes de /{resena_id}) ----------
@router.get("/mias", response_model=list[ResenaOut])
def mis_resenas(usuario: UsuarioActual, db: DB):
    return repo.listar_resenas(db, usuario_id=usuario.id, limit=500)


@router.post("/mias", response_model=ResenaOut, status_code=status.HTTP_201_CREATED)
def dejar_resena(datos: MiResenaIn, usuario: UsuarioActual, db: DB, tareas: BackgroundTasks):
    """El cliente reseña una de sus citas ya terminadas; queda ligada a los productos de esa cita."""
    cita = obtener_cita(datos.cita_id)
    if cita["usuario_id"] != usuario.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada")
    if cita["estado"] != "terminado":
        raise HTTPException(status.HTTP_409_CONFLICT, "Solo puedes reseñar citas terminadas")
    if repo.resena_de_cita(db, datos.cita_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya dejaste una reseña para esta cita")
    # Los productos que se hayan borrado del catálogo desde la cita simplemente no se ligan
    productos = repo.productos_por_id(db, [p["producto_id"] for p in cita["productos"]])
    r = Resena(
        nombre_cliente=cita["nombre_cliente"],
        descripcion=datos.descripcion,
        usuario_id=usuario.id,
        cita_id=datos.cita_id,
        productos=productos,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    tareas.add_task(
        registrar_actividad, usuario.username, f"Nueva reseña de {r.nombre_cliente}", "nuevo"
    )
    return r


# ---------- Público / administración ----------
@router.get("/{resena_id}", response_model=ResenaOut)
def obtener_resena(resena_id: int, db: DB):
    return _obtener_o_404(db, resena_id)


@router.post("", response_model=ResenaOut, status_code=status.HTTP_201_CREATED)
def crear_resena(datos: ResenaIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    productos = _productos(db, datos.producto_ids)
    r = Resena(**datos.model_dump(exclude={"producto_ids"}, exclude_none=True), productos=productos)
    db.add(r)
    db.commit()
    db.refresh(r)
    tareas.add_task(
        registrar_actividad, admin.username, f"Nueva reseña de {r.nombre_cliente}", "nuevo"
    )
    return r


@router.patch("/{resena_id}", response_model=ResenaOut)
def editar_resena(resena_id: int, datos: ResenaUpdate, admin: Admin, db: DB, tareas: BackgroundTasks):
    r = _obtener_o_404(db, resena_id)
    cambios = datos.model_dump(exclude_unset=True, exclude_none=True)
    if (ids := cambios.pop("producto_ids", None)) is not None:
        r.productos = _productos(db, ids)
    for campo, valor in cambios.items():
        setattr(r, campo, valor)
    db.commit()
    db.refresh(r)
    tareas.add_task(
        registrar_actividad, admin.username, f"Modificó la reseña de {r.nombre_cliente}", "modificacion"
    )
    return r


@router.delete("/{resena_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_resena(resena_id: int, admin: Admin, db: DB, tareas: BackgroundTasks):
    r = _obtener_o_404(db, resena_id)
    nombre = r.nombre_cliente
    db.delete(r)
    db.commit()
    tareas.add_task(
        registrar_actividad, admin.username, f"Eliminó la reseña de {nombre}", "eliminacion"
    )
