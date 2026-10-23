from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Categoria, Etiqueta, Producto, Resena


# ---------- Categorías ----------
def listar_categorias(db: Session) -> list[tuple[Categoria, int]]:
    stmt = (
        select(Categoria, func.count(Producto.id))
        .outerjoin(Producto, Producto.categoria_id == Categoria.id)
        .group_by(Categoria.id)
        .order_by(Categoria.nombre)
    )
    return [(c, n) for c, n in db.execute(stmt)]


def contar_productos_de(db: Session, categoria_id: int) -> int:
    return db.scalar(
        select(func.count(Producto.id)).where(Producto.categoria_id == categoria_id)
    ) or 0


def categoria_por_nombre(db: Session, nombre: str) -> Categoria | None:
    return db.scalars(
        select(Categoria).where(func.lower(Categoria.nombre) == nombre.strip().lower())
    ).first()


# ---------- Etiquetas ----------
def listar_etiquetas(db: Session) -> list[Etiqueta]:
    return list(db.scalars(select(Etiqueta).order_by(Etiqueta.nombre)))


def etiquetas_por_nombre(db: Session, nombres: list[str]) -> tuple[list[Etiqueta], list[str]]:
    """Devuelve (etiquetas encontradas, nombres que no existen)."""
    limpios = {n.strip().lower() for n in nombres if n.strip()}
    if not limpios:
        return [], []
    encontradas = list(db.scalars(select(Etiqueta).where(func.lower(Etiqueta.nombre).in_(limpios))))
    faltan = sorted(limpios - {e.nombre.lower() for e in encontradas})
    return encontradas, faltan


# ---------- Productos ----------
def listar_productos(
    db: Session,
    categoria_id: int | None = None,
    etiqueta: str | None = None,
    disponibilidad: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Producto]:
    stmt = select(Producto)
    if categoria_id is not None:
        stmt = stmt.where(Producto.categoria_id == categoria_id)
    if disponibilidad:
        stmt = stmt.where(Producto.disponibilidad == disponibilidad)
    if etiqueta:
        stmt = stmt.where(Producto.etiquetas.any(func.lower(Etiqueta.nombre) == etiqueta.lower()))
    if q:
        patron = f"%{q.strip()}%"
        stmt = stmt.where(or_(Producto.nombre.ilike(patron), Producto.descripcion.ilike(patron)))
    stmt = stmt.order_by(Producto.created_at.desc(), Producto.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt).unique())


def contar_productos(db: Session) -> int:
    return db.scalar(select(func.count(Producto.id))) or 0


# ---------- Reseñas ----------
def listar_resenas(
    db: Session, producto_id: int | None = None, limit: int = 100, offset: int = 0
) -> list[Resena]:
    stmt = select(Resena)
    if producto_id is not None:
        stmt = stmt.where(Resena.producto_id == producto_id)
    stmt = stmt.order_by(Resena.fecha.desc(), Resena.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt).unique())
