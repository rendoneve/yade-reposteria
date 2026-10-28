from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import SCHEMA, Base


class CitaProducto(Base):
    """Productos del catálogo que se piden en la cita. Sin FK hacia catalogo (es otro servicio):
    se guarda el nombre que tenía al agendar para mostrarlo aunque después cambie o se borre."""

    __tablename__ = "cita_productos"

    cita_id: Mapped[int] = mapped_column(
        ForeignKey(f"{SCHEMA}.citas.id", ondelete="CASCADE"), primary_key=True
    )
    producto_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150))


class Cita(Base):
    __tablename__ = "citas"

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    nombre_cliente: Mapped[str] = mapped_column(String(100))
    telefono: Mapped[str] = mapped_column(String(20))
    correo: Mapped[str | None] = mapped_column(String(150))
    detalles: Mapped[str | None] = mapped_column(Text)
    tipo_servicio: Mapped[str] = mapped_column(String(100))
    estado: Mapped[str] = mapped_column(String(20), default="proximo")
    usuario_id: Mapped[int | None] = mapped_column(Integer)  # cliente con cuenta (auth.usuarios), sin FK
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    productos: Mapped[list[CitaProducto]] = relationship(
        lazy="selectin", cascade="all, delete-orphan", order_by=CitaProducto.nombre
    )
