from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core import almacenamiento, cache
from app.core.actividad import registrar_actividad
from app.core.database import get_db, leer
from app.core.security import Admin
from app.models import Categoria, Etiqueta, Producto
from app.schemas import (
    ConteoOut,
    Disponibilidad,
    ProductoIn,
    ProductoOpcionOut,
    ProductoOut,
    ProductoUpdate,
)

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


def _validar_categoria(db: Session, categoria_id: int) -> Categoria:
    categoria = db.get(Categoria, categoria_id)
    if not categoria:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La categoría no existe")
    return categoria


def _resolver_etiquetas(db: Session, nombres: list[str]) -> list[Etiqueta]:
    encontradas, faltan = repo.etiquetas_por_nombre(db, nombres)
    if faltan:
        validas = ", ".join(e.nombre for e in repo.listar_etiquetas(db))
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Etiqueta(s) no válidas: {', '.join(faltan)}. Usa: {validas}",
        )
    return sorted(encontradas, key=lambda e: e.nombre)


# Las listas públicas sin búsqueda se sirven desde la caché (no usan Depends(get_db):
# solo abren sesión cuando la caché está vacía). leer() repite la consulta si Neon cortó la conexión.
@router.get("", response_model=list[ProductoOut])
def listar_productos(
    categoria_id: int | None = None,
    etiqueta: str | None = Query(default=None, examples=["mas vendidos"]),
    disponibilidad: Disponibilidad | None = None,
    q: str | None = Query(default=None, description="Busca en nombre y descripción"),
    ids: list[int] | None = Query(default=None, max_length=20, description="Filtra por IDs (uso interno por lotes)"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    def cargar() -> list[ProductoOut]:
        return leer(lambda db: [
            _out(p) for p in repo.listar_productos(db, categoria_id, etiqueta, disponibilidad, q, ids, limit, offset)
        ])

    if q or ids:
        return cargar()
    clave = f"productos:{categoria_id}:{(etiqueta or '').lower()}:{disponibilidad}:{limit}:{offset}"
    return cache.obtener(clave, cargar)


@router.get("/opciones", response_model=list[ProductoOpcionOut])
def opciones_productos():
    """Solo id, nombre y categoría: para el selector de productos al agendar una cita."""

    return cache.obtener("productos:opciones", lambda: leer(repo.productos_opciones))


@router.get("/destacados", response_model=list[ProductoOut])
def productos_destacados(limit: int = Query(default=4, ge=1, le=20)):
    """"Especiales del mes" de Inicio: los más vendidos o, si no hay, los más recientes."""

    return cache.obtener(
        f"productos:destacados:{limit}", lambda: leer(lambda db: [_out(p) for p in repo.productos_destacados(db, limit)])
    )


# Va antes de /{producto_id} para que "count" no se interprete como id
@router.get("/count", response_model=ConteoOut)
def contar_productos(db: DB):
    return ConteoOut(total=repo.contar_productos(db))


@router.get("/resumen")
def resumen_productos(admin: Admin, db: DB):
    """Conteos de inventario: solo para el panel (servicio-actividad lo pide con el token del admin)."""
    return repo.resumen_productos(db)


@router.get("/{producto_id}", response_model=ProductoOut)
def obtener_producto(producto_id: int, db: DB):
    return _out(_obtener_o_404(db, producto_id))


@router.post("", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
def crear_producto(datos: ProductoIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    categoria = _validar_categoria(db, datos.categoria_id)
    etiquetas = _resolver_etiquetas(db, datos.etiquetas)
    p = Producto(**datos.model_dump(exclude={"etiquetas"}), categoria=categoria, etiquetas=etiquetas)
    db.add(p)
    db.commit()
    cache.limpiar()
    tareas.add_task(registrar_actividad, admin.username, f"Nuevo producto: {p.nombre}", "nuevo")
    return _out(p)


@router.patch("/{producto_id}", response_model=ProductoOut)
def editar_producto(
    producto_id: int, datos: ProductoUpdate, admin: Admin, db: DB, tareas: BackgroundTasks
):
    p = _obtener_o_404(db, producto_id)
    cambios = datos.model_dump(exclude_unset=True)
    imagen_anterior = p.imagen_url
    if "categoria_id" in cambios:
        p.categoria = _validar_categoria(db, cambios.pop("categoria_id"))
    if (nombres := cambios.pop("etiquetas", None)) is not None:
        p.etiquetas = _resolver_etiquetas(db, nombres)
    for campo, valor in cambios.items():
        setattr(p, campo, valor)
    db.commit()
    cache.limpiar()
    if imagen_anterior != p.imagen_url and not repo.imagen_en_uso(db, imagen_anterior):
        tareas.add_task(almacenamiento.borrar, imagen_anterior)
    tareas.add_task(
        registrar_actividad, admin.username, f"Modificó el producto {p.nombre}", "modificacion"
    )
    return _out(p)


@router.delete("/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_producto(producto_id: int, admin: Admin, db: DB, tareas: BackgroundTasks):
    p = _obtener_o_404(db, producto_id)
    nombre = p.nombre
    imagen = p.imagen_url
    db.delete(p)  # sus reseñas se quedan; solo se quita el vínculo (ON DELETE CASCADE)
    db.commit()
    cache.limpiar()
    if not repo.imagen_en_uso(db, imagen):
        tareas.add_task(almacenamiento.borrar, imagen)
    tareas.add_task(registrar_actividad, admin.username, f"Eliminó el producto {nombre}", "eliminacion")
