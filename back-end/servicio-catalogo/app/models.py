from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Table, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import SCHEMA, Base

producto_etiqueta = Table(
    "producto_etiqueta",
    Base.metadata,
    Column("producto_id", ForeignKey(f"{SCHEMA}.productos.id", ondelete="CASCADE"), primary_key=True),
    Column("etiqueta_id", ForeignKey(f"{SCHEMA}.etiquetas.id", ondelete="CASCADE"), primary_key=True),
)

# Una reseña habla de uno o varios productos (los de la cita que se reseña)
resena_producto = Table(
    "resena_producto",
    Base.metadata,
    Column("resena_id", ForeignKey(f"{SCHEMA}.resenas.id", ondelete="CASCADE"), primary_key=True),
    Column("producto_id", ForeignKey(f"{SCHEMA}.productos.id", ondelete="CASCADE"), primary_key=True),
)


class Categoria(Base):
    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True)
    imagen_url: Mapped[str | None] = mapped_column(String(500))


class Etiqueta(Base):
    __tablename__ = "etiquetas"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(50), unique=True)


class Producto(Base):
    __tablename__ = "productos"
    # Trae id, fechas y valores por defecto en el mismo INSERT/UPDATE (RETURNING): sin db.refresh()
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150))
    descripcion: Mapped[str] = mapped_column(Text, default="")
    precio: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    imagen_url: Mapped[str | None] = mapped_column(String(500))
    disponibilidad: Mapped[str] = mapped_column(String(30), default="stock")
    categoria_id: Mapped[int] = mapped_column(
        ForeignKey(f"{SCHEMA}.categorias.id", ondelete="RESTRICT")
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    categoria: Mapped[Categoria] = relationship(lazy="joined")
    etiquetas: Mapped[list[Etiqueta]] = relationship(
        secondary=producto_etiqueta, lazy="selectin", order_by=Etiqueta.nombre
    )


class Resena(Base):
    __tablename__ = "resenas"
    # Trae id, fechas y valores por defecto en el mismo INSERT/UPDATE (RETURNING): sin db.refresh()
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre_cliente: Mapped[str] = mapped_column(String(100))
    descripcion: Mapped[str] = mapped_column(Text)
    fecha: Mapped[date] = mapped_column(Date, server_default=func.current_date())
    # Reseñas que deja un cliente con cuenta: su usuario (auth) y la cita terminada (citas), sin FK
    usuario_id: Mapped[int | None] = mapped_column(Integer)
    cita_id: Mapped[int | None] = mapped_column(Integer, unique=True)

    productos: Mapped[list[Producto]] = relationship(
        secondary=resena_producto, lazy="selectin", order_by=Producto.nombre
    )
