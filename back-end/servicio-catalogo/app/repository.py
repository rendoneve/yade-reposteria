from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, load_only, noload, selectinload

from app.models import Categoria, Etiqueta, Producto, Resena

# De un producto ligado a una reseña solo se muestran id y nombre: no hace falta
# traer su categoría ni sus etiquetas (eran 2 consultas extra por cada lista de reseñas).
_SOLO_NOMBRE = (load_only(Producto.id, Producto.nombre), noload(Producto.categoria), noload(Producto.etiquetas))
CARGA_RESENA = selectinload(Resena.productos).options(*_SOLO_NOMBRE)


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
    ids: list[int] | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Producto]:
    stmt = select(Producto)
    if ids is not None:
        stmt = stmt.where(Producto.id.in_(ids))
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


def productos_opciones(db: Session) -> list[dict]:
    """Lista ligera (id, nombre, categoría) para llenar selects sin bajar el catálogo completo."""
    filas = db.execute(
        select(Producto.id, Producto.nombre, Categoria.nombre)
        .join(Categoria, Producto.categoria_id == Categoria.id)
        .order_by(Producto.nombre)
    )
    return [{"id": i, "nombre": n, "categoria_nombre": c} for i, n, c in filas]


def productos_destacados(db: Session, limit: int) -> list[Producto]:
    """Los "mas vendidos"; si no hay ninguno, los más recientes."""
    return listar_productos(db, etiqueta="mas vendidos", limit=limit) or listar_productos(db, limit=limit)


def contar_productos(db: Session) -> int:
    return db.scalar(select(func.count(Producto.id))) or 0


def resumen_productos(db: Session) -> dict[str, int]:
    """Conteos para el panel, sin transferir todo el catálogo al navegador."""
    filas = db.execute(
        select(Producto.disponibilidad, func.count(Producto.id)).group_by(Producto.disponibilidad)
    )
    resumen = {"stock": 0, "bajo pedido": 0, "proximamente": 0}
    for disponibilidad, cantidad in filas:
        resumen[disponibilidad] = cantidad
    resumen["total"] = sum(resumen.values())
    return resumen


# ---------- Reseñas ----------
def listar_resenas(
    db: Session,
    producto_id: int | None = None,
    usuario_id: int | None = None,
    limit: int = 100,
    offset: int = 0,
    aprobada: bool | None = None,
) -> list[Resena]:
    stmt = select(Resena).options(CARGA_RESENA)
    if aprobada is not None:
        stmt = stmt.where(Resena.aprobada == aprobada)
    if producto_id is not None:
        stmt = stmt.where(Resena.productos.any(Producto.id == producto_id))
    if usuario_id is not None:
        stmt = stmt.where(Resena.usuario_id == usuario_id)
    stmt = stmt.order_by(Resena.fecha.desc(), Resena.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt).unique())


def resumen_resenas(db: Session) -> dict:
    """Total de reseñas publicadas y promedio de estrellas (solo cuentan las que tienen calificación)."""
    total, con_calificacion, promedio = db.execute(
        select(
            func.count(Resena.id),
            func.count(Resena.calificacion),
            func.avg(Resena.calificacion),
        ).where(Resena.aprobada.is_(True))
    ).one()
    return {
        "total": total,
        "con_calificacion": con_calificacion,
        "promedio": round(float(promedio), 1) if promedio is not None else None,
    }


def resena_de_cita(db: Session, cita_id: int) -> int | None:
    """Id de la reseña que ya tiene esa cita (o None)."""
    return db.scalar(select(Resena.id).where(Resena.cita_id == cita_id))


def productos_por_id(db: Session, ids: list[int]) -> list[Producto]:
    if not ids:
        return []
    return list(db.scalars(select(Producto).options(*_SOLO_NOMBRE).where(Producto.id.in_(ids))))


# ---------- Imágenes ----------
def imagen_en_uso(db: Session, url: str | None) -> bool:
    """¿Algún producto o categoría sigue usando esta imagen? (para no borrarla del bucket por error)"""
    if not url:
        return False
    return bool(
        db.scalar(select(Producto.id).where(Producto.imagen_url == url).limit(1))
        or db.scalar(select(Categoria.id).where(Categoria.imagen_url == url).limit(1))
    )
