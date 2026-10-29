from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Actividad(Base):
    __tablename__ = "actividades"
    # Trae id, fechas y valores por defecto en el mismo INSERT/UPDATE (RETURNING): sin db.refresh()
    __mapper_args__ = {"eager_defaults": True}

    id: Mapped[int] = mapped_column(primary_key=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    persona: Mapped[str] = mapped_column(String(100))
    nombre: Mapped[str] = mapped_column(String(255))
    tipo: Mapped[str] = mapped_column(String(30))  # nuevo, modificacion, eliminacion, ...
