from datetime import date, datetime, time
from typing import Annotated, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, EmailStr, Field

# "especial", "individual", "pasteles" o el nombre de una categoría del catálogo
TipoServicio = Annotated[str, Field(min_length=1, max_length=100)]
Estado = Literal["proximo", "cancelado", "en proceso", "terminado"]
TELEFONO_PATRON = r"^[0-9+()\s-]{7,20}$"
# Productos del catálogo que se piden en la cita
ProductoIds = Annotated[list[int], Field(max_length=20, examples=[[3, 7]])]


class CitaIn(BaseModel):
    """Lo que manda el cliente desde el sitio. La fecha debe llevar zona horaria,
    p. ej. 2026-11-05T16:00:00-07:00 (hora de Sinaloa)."""

    fecha: AwareDatetime
    nombre_cliente: str = Field(min_length=1, max_length=100)
    telefono: str = Field(pattern=TELEFONO_PATRON)
    correo: EmailStr | None = None
    detalles: str | None = Field(default=None, max_length=2000)
    tipo_servicio: TipoServicio
    producto_ids: ProductoIds = Field(default_factory=list)


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
    producto_ids: ProductoIds | None = None


class EstadoIn(BaseModel):
    estado: Estado


class ProductoCitaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    producto_id: int
    nombre: str


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
    usuario_id: int | None
    productos: list[ProductoCitaOut]
    created_at: datetime
    updated_at: datetime


class CitaPublicaOut(BaseModel):
    """Respuesta al cliente: solo confirma, no expone datos de otras citas."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: datetime
    tipo_servicio: TipoServicio
    estado: Estado


class CitaInternaOut(BaseModel):
    """Lo que servicio-catalogo necesita para validar una reseña."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    usuario_id: int | None
    estado: Estado
    nombre_cliente: str
    productos: list[ProductoCitaOut]


class ConteoOut(BaseModel):
    total: int


class CitaPanelOut(BaseModel):
    """Campos mínimos para el resumen administrativo."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    fecha: datetime
    nombre_cliente: str
    telefono: str
    correo: str | None
    detalles: str | None


class ResumenAdminOut(BaseModel):
    citas_proximas: int
    citas_terminadas: int
    siguientes: list[CitaPanelOut]


class FranjaOut(BaseModel):
    inicio: datetime  # con la zona horaria del negocio
    disponible: bool


class DisponibilidadOut(BaseModel):
    """Horas en que se puede agendar un día. Si los horarios no están configurados
    (`configurado = false`), el sitio deja escoger cualquier hora."""

    fecha: date
    configurado: bool
    abierto: bool
    abre: time | None = None
    cierra: time | None = None
    duracion_minutos: int
    franjas: list[FranjaOut] = Field(default_factory=list)
