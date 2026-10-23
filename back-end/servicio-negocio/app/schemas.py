from datetime import datetime, time

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


class NegocioUpdate(BaseModel):
    banner_url: str | None = Field(default=None, max_length=500)
    texto_principal: str | None = None
    texto_acerca: str | None = None
    whatsapp: str | None = Field(
        default=None, pattern=r"^\+?[0-9]{10,15}$", description="Solo números, p. ej. 5216681234567"
    )
    ubicacion: str | None = Field(default=None, max_length=255)
    mapa_url: str | None = Field(default=None, max_length=500)


class NegocioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    banner_url: str | None
    texto_principal: str | None
    texto_acerca: str | None
    whatsapp: str | None
    ubicacion: str | None
    mapa_url: str | None
    updated_at: datetime
    horarios: list[HorarioOut] = []
