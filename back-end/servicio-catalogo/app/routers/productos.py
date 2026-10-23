from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.actividad import registrar_actividad
from app.core.database import get_db
from app.core.security import Admin
from app.models import Categoria, Etiqueta, Producto
from app.schemas import ConteoOut, Disponibilidad, ProductoIn, ProductoOut, ProductoUpdate

router = APIRouter(prefix="/productos", tags=["Productos"])
DB = Annotated[Session, Depends(get_db)]


def _out(p: Producto) -> ProductoOut:
    out = ProductoOut.model_validate(p)
    out.categoria_nombre = p.categoria.nombre if p.categoria else None
    return out


def _obtener_o_404(db: Session, producto_id: int) -> Producto:
    p = db.get(Producto, producto_id)
    if not p:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Producto no encontrado")
    return p


def _validar_categoria(db: Session, categoria_id: int) -> None:
    if not db.get(Categoria, categoria_id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La categoría no existe")


def _resolver_etiquetas(db: Session, nombres: list[str]) -> list[Etiqueta]:
    encontradas, faltan = repo.etiquetas_por_nombre(db, nombres)
    if faltan:
        validas = ", ".join(e.nombre for e in repo.listar_etiquetas(db))
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Etiqueta(s) no válidas: {', '.join(faltan)}. Usa: {validas}",
        )
    return encontradas


@router.get("", response_model=list[ProductoOut])
def listar_productos(
    db: DB,
    categoria_id: int | None = None,
    etiqueta: str | None = Query(default=None, examples=["mas vendidos"]),
    disponibilidad: Disponibilidad | None = None,
    q: str | None = Query(default=None, description="Busca en nombre y descripción"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    productos = repo.listar_productos(db, categoria_id, etiqueta, disponibilidad, q, limit, offset)
    return [_out(p) for p in productos]


# Va antes de /{producto_id} para que "count" no se interprete como id
@router.get("/count", response_model=ConteoOut)
def contar_productos(db: DB):
    return ConteoOut(total=repo.contar_productos(db))


@router.get("/{producto_id}", response_model=ProductoOut)
def obtener_producto(producto_id: int, db: DB):
    return _out(_obtener_o_404(db, producto_id))


@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
def crear_producto(datos: ProductoIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    _validar_categoria(db, datos.categoria_id)
    etiquetas = _resolver_etiquetas(db, datos.etiquetas)
    p = Producto(**datos.model_dump(exclude={"etiquetas"}), etiquetas=etiquetas)
    db.add(p)
    db.commit()
    db.refresh(p)
    tareas.add_task(registrar_actividad, admin.username, f"Nuevo producto: {p.nombre}", "nuevo")
    return _out(p)


@router.patch("/{producto_id}", response_model=ProductoOut)
def editar_producto(
    producto_id: int, datos: ProductoUpdate, admin: Admin, db: DB, tareas: BackgroundTasks
):
    p = _obtener_o_404(db, producto_id)
    cambios = datos.model_dump(exclude_unset=True)
    if "categoria_id" in cambios:
        _validar_categoria(db, cambios["categoria_id"])
    if (nombres := cambios.pop("etiquetas", None)) is not None:
        p.etiquetas = _resolver_etiquetas(db, nombres)
    for campo, valor in cambios.items():
        setattr(p, campo, valor)
    db.commit()
    db.refresh(p)
    tareas.add_task(
        registrar_actividad, admin.username, f"Modificó el producto {p.nombre}", "modificacion"
    )
    return _out(p)


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(producto_id: int, admin: Admin, db: DB, tareas: BackgroundTasks):
    p = _obtener_o_404(db, producto_id)
    nombre = p.nombre
    db.delete(p)  # sus reseñas se borran también (ON DELETE CASCADE)
    db.commit()
    tareas.add_task(registrar_actividad, admin.username, f"Eliminó el producto {nombre}", "eliminacion")
