from datetime import datetime
from typing import Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field

TipoServicio = Literal["especial", "individual", "pasteles"]
Estado = Literal["proximo", "cancelado", "en proceso", "terminado"]
TELEFONO_PATRON = r"^[0-9+()\s-]{7,20}$"


class CitaIn(BaseModel):
    """Lo que manda el cliente desde el sitio. La fecha debe llevar zona horaria,
    p. ej. 2026-11-05T16:00:00-07:00 (hora de Sinaloa)."""

    fecha: AwareDatetime
    nombre_cliente: str = Field(min_length=1, max_length=100)
    telefono: str = Field(pattern=TELEFONO_PATRON)
    correo: EmailStr | None = None
    detalles: str | None = Field(default=None, max_length=2000)
    tipo_servicio: TipoServicio


class CitaAdminIn(CitaIn):
    """El administrador también puede capturar citas (p. ej. por teléfono) y elegir el estado."""

    estado: Estado = "proximo"


class CitaUpdate(BaseModel):
    fecha: AwareDatetime | None = None
    nombre_cliente: str | None = Field(default=None, min_length=1, max_length=100)
    telefono: str | None = Field(default=None, pattern=TELEFONO_PATRON)
    correo: EmailStr | None = None
    detalles: str | None = Field(default=None, max_length=2000)
    tipo_servicio: TipoServicio | None = None
    estado: Estado | None = None


class EstadoIn(BaseModel):
    estado: Estado


class CitaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: datetime
    nombre_cliente: str
    telefono: str
    correo: str | None
    detalles: str | None
    tipo_servicio: TipoServicio
    estado: Estado
    created_at: datetime
    updated_at: datetime


class CitaPublicaOut(BaseModel):
    """Respuesta al cliente: solo confirma, no expone datos de otras citas."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: datetime
    tipo_servicio: TipoServicio
    estado: Estado


class ConteoOut(BaseModel):
    total: int
