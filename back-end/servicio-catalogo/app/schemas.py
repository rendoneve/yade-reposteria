from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

Disponibilidad = Literal["bajo pedido", "stock", "proximamente"]
URL = Field(default=None, max_length=500)
CENTAVOS = Decimal("0.01")


def _a_centavos(v: Decimal | None) -> Decimal | None:
    """12 -> 12.00, igual que NUMERIC(10, 2): la respuesta sale como la guarda la BD sin volver a leerla."""
    return v.quantize(CENTAVOS) if v is not None else None


# ---------- Etiquetas ----------
class EtiquetaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=50)


class EtiquetaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    nombre: str


# ---------- Categorías ----------
class CategoriaIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    imagen_url: str | None = URL


class CategoriaUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    imagen_url: str | None = URL


class CategoriaOut(BaseModel):
    id: int
    nombre: str
    imagen_url: str | None = None
    cantidad_productos: int = 0


# ---------- Productos ----------
class ProductoIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    descripcion: str = ""
    precio: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    imagen_url: str | None = URL
    disponibilidad: Disponibilidad = "stock"
    categoria_id: int
    etiquetas: list[str] = Field(default_factory=list, examples=[["nuevos", "sin azucar"]])

    _precio = field_validator("precio")(_a_centavos)


class ProductoUpdate(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=150)
    descripcion: str | None = None
    precio: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    imagen_url: str | None = URL
    disponibilidad: Disponibilidad | None = None
    categoria_id: int | None = None
    etiquetas: list[str] | None = None

    _precio = field_validator("precio")(_a_centavos)


class ProductoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    descripcion: str
    precio: Decimal
    imagen_url: str | None
    disponibilidad: Disponibilidad
    categoria_id: int
    categoria_nombre: str | None = None
    etiquetas: list[str]
    created_at: datetime

    @field_validator("etiquetas", mode="before")
    @classmethod
    def etiquetas_a_nombres(cls, v):
        return [e.nombre if hasattr(e, "nombre") else e for e in v]


class ProductoOpcionOut(BaseModel):
    """Versión ligera para selects (sin descripción, imagen ni etiquetas)."""

    id: int
    nombre: str
    categoria_nombre: str


class ConteoOut(BaseModel):
    total: int


# ---------- Reseñas ----------
# Las captura el administrador o las deja un cliente sobre una cita terminada.
class ResenaIn(BaseModel):
    nombre_cliente: str = Field(min_length=1, max_length=100)
    descripcion: str = Field(min_length=1)
    producto_ids: list[int] = Field(min_length=1, max_length=20)
    fecha: date | None = None  # si no se manda, la BD pone la fecha de hoy


class ResenaUpdate(BaseModel):
    nombre_cliente: str | None = Field(default=None, min_length=1, max_length=100)
    descripcion: str | None = Field(default=None, min_length=1)
    producto_ids: list[int] | None = Field(default=None, min_length=1, max_length=20)
    fecha: date | None = None


class MiResenaIn(BaseModel):
    """Reseña de un cliente: va ligada a su cita terminada y a los productos de esa cita."""

    cita_id: int
    descripcion: str = Field(min_length=1, max_length=2000)


class ProductoResenaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class ResenaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre_cliente: str
    descripcion: str
    fecha: date
    productos: list[ProductoResenaOut]
    cita_id: int | None
    usuario_id: int | None
