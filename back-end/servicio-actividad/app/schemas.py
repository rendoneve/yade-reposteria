from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ActividadIn(BaseModel):
    persona: str = Field(min_length=1, max_length=100)
    nombre: str = Field(min_length=1, max_length=255)
    tipo: str = Field(min_length=1, max_length=30, examples=["nuevo", "modificacion", "eliminacion"])


class ActividadOut(ActividadIn):
    model_config = ConfigDict(from_attributes=True)
    id: int
    fecha: datetime


class EstadisticasOut(BaseModel):
    # None = ese dato no se pudo obtener (el motivo viene en "errores")
    productos_en_catalogo: int | None
    citas_proximas: int | None
    citas_terminadas: int | None
    actividad_reciente: list[ActividadOut]
    errores: dict[str, str] = Field(default_factory=dict)
