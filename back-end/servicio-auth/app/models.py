from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Usuario(Base):
    __tablename__ = "usuarios"
    # Trae id, fechas y valores por defecto en el mismo INSERT/UPDATE (RETURNING): sin db.refresh()
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre_completo: Mapped[str] = mapped_column(String(150))
    username: Mapped[str] = mapped_column(String(50), unique=True)
    correo: Mapped[str] = mapped_column(String(150))
    password_hash: Mapped[str] = mapped_column(String(255))
    telefono: Mapped[str | None] = mapped_column(String(20))
    rol: Mapped[str] = mapped_column(String(20), default="cliente")
    activo: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
