from datetime import datetime, time
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"]


class HorarioIn(BaseModel):
    dia_semana: int = Field(ge=0, le=6, description="0 = domingo ... 6 = sábado")
    abre: time | None = None
    cierra: time | None = None
    cerrado: bool = False

    @model_validator(mode="after")
    def _coherente(self):
        if self.cerrado:
            self.abre = self.cierra = None
        elif self.abre is None or self.cierra is None:
            raise ValueError("Indica hora de apertura y de cierre, o marca el día como cerrado")
        elif self.abre >= self.cierra:
            raise ValueError("La hora de apertura debe ser antes que la de cierre")
        return self


class HorarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    dia_semana: int
    abre: time | None
    cierra: time | None
    cerrado: bool

    @computed_field
    @property
    def dia(self) -> str:
        return DIAS[self.dia_semana]


# Dónde se muestra un video; None = subido pero sin mostrar
UbicacionVideo = Literal["hero_inicio", "seccion_inicio", "nosotros", "hero_acerca"]


class VideoIn(BaseModel):
    url: str = Field(max_length=500, pattern=r"^https?://")
    # Un mismo video puede mostrarse en varios lugares a la vez; lista vacía = guardado sin mostrar
    ubicaciones: list[UbicacionVideo] = Field(default_factory=list, max_length=4)
    titulo: str | None = Field(default=None, max_length=100)

    @model_validator(mode="before")
    @classmethod
    def _compatibilidad(cls, datos):
        """Acepta el formato anterior (`ubicacion` única) y quita lugares repetidos."""
        if isinstance(datos, dict):
            datos = dict(datos)
            if "ubicacion" in datos:
                antigua = datos.pop("ubicacion")
                if not datos.get("ubicaciones") and antigua:
                    datos["ubicaciones"] = [antigua]
            if isinstance(datos.get("ubicaciones"), list):
                datos["ubicaciones"] = list(dict.fromkeys(datos["ubicaciones"]))
        return datos


class NegocioUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=100)
    logo_url: str | None = Field(default=None, max_length=500)
    hero_url: str | None = Field(default=None, max_length=500)
    catalogo_url: str | None = Field(default=None, max_length=500)
    banner_url: str | None = Field(default=None, max_length=500)
    texto_principal: str | None = None
    texto_catalogo: str | None = None
    texto_acerca: str | None = None
    whatsapp: str | None = Field(
        default=None, pattern=r"^\+?[0-9]{10,15}$", description="Solo números, p. ej. 5216681234567"
    )
    ubicacion: str | None = Field(default=None, max_length=255)
    mapa_url: str | None = Field(default=None, max_length=500)
    videos: list[VideoIn] | None = Field(default=None, max_length=12)


class NegocioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    nombre: str | None
    logo_url: str | None
    hero_url: str | None
    catalogo_url: str | None
    banner_url: str | None
    texto_principal: str | None
    texto_catalogo: str | None
    texto_acerca: str | None
    whatsapp: str | None
    ubicacion: str | None
    mapa_url: str | None
    videos: list[VideoIn] = []
    updated_at: datetime
    horarios: list[HorarioOut] = []
