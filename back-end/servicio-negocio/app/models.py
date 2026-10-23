from datetime import datetime, time

from sqlalchemy import Boolean, DateTime, SmallInteger, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Negocio(Base):
    """Una sola fila (id = 1) con el contenido editable del sitio."""

    __tablename__ = "negocio"

    id: Mapped[int] = mapped_column(SmallInteger, primary_key=True, default=1)
    banner_url: Mapped[str | None] = mapped_column(String(500))
    texto_principal: Mapped[str | None] = mapped_column(Text)
    texto_acerca: Mapped[str | None] = mapped_column(Text)
    whatsapp: Mapped[str | None] = mapped_column(String(20))
    ubicacion: Mapped[str | None] = mapped_column(String(255))
    mapa_url: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Horario(Base):
    __tablename__ = "horarios"

    dia_semana: Mapped[int] = mapped_column(SmallInteger, primary_key=True)  # 0 = domingo
    abre: Mapped[time | None] = mapped_column(Time)
    cierra: Mapped[time | None] = mapped_column(Time)
    cerrado: Mapped[bool] = mapped_column(Boolean, default=False)
