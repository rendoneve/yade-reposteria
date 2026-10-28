from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

USERNAME = Field(min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$")
TELEFONO = Field(default=None, max_length=20, pattern=r"^[0-9+()\s-]{7,20}$")


class LoginIn(BaseModel):
    usuario: str = Field(min_length=1, max_length=150, description="Nombre de usuario o correo")
    password: str = Field(min_length=1, max_length=128)


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre_completo: str
    username: str
    correo: str
    telefono: str | None
    rol: str
    activo: bool
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # segundos
    usuario: UsuarioOut


class UsuarioIn(BaseModel):
    nombre_completo: str = Field(min_length=1, max_length=150)
    username: str = USERNAME
    correo: EmailStr
    password: str = Field(min_length=8, max_length=128)
    telefono: str | None = TELEFONO


class RegistroIn(BaseModel):
    """Cuenta de cliente creada desde el sitio."""

    nombre_completo: str = Field(min_length=1, max_length=150)
    username: str = USERNAME
    correo: EmailStr
    password: str = Field(min_length=8, max_length=128)
    telefono: str | None = TELEFONO


class UsuarioUpdate(BaseModel):
    nombre_completo: str | None = Field(default=None, min_length=1, max_length=150)
    username: str | None = Field(
        default=None, min_length=3, max_length=50, pattern=r"^[A-Za-z0-9_.-]+$"
    )
    correo: EmailStr | None = None
    telefono: str | None = TELEFONO
    activo: bool | None = None
    password: str | None = Field(default=None, min_length=8, max_length=128)


class PerfilUpdate(BaseModel):
    """Lo que cada usuario puede cambiar de sí mismo."""

    nombre_completo: str | None = Field(default=None, min_length=1, max_length=150)
    correo: EmailStr | None = None
    telefono: str | None = TELEFONO


class CambioPassword(BaseModel):
    actual: str = Field(min_length=1)
    nueva: str = Field(min_length=8, max_length=128)
