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


class CitaPanelOut(BaseModel):
    id: int
    fecha: datetime
    nombre_cliente: str
    telefono: str
    correo: str | None
    detalles: str | None


class InventarioOut(BaseModel):
    total: int
    stock: int
    bajo_pedido: int = Field(alias="bajo pedido")
    proximamente: int

    model_config = ConfigDict(populate_by_name=True)


class EstadisticasOut(BaseModel):
    # None = ese dato no se pudo obtener (el motivo viene en "errores")
    productos_en_catalogo: int | None
    inventario: InventarioOut | None
    citas_proximas: int | None
    citas_terminadas: int | None
    citas_siguientes: list[CitaPanelOut] = Field(default_factory=list)
    actividad_reciente: list[ActividadOut]
    errores: dict[str, str] = Field(default_factory=dict)
