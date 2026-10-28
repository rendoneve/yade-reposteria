"""Verificación del JWT que emite servicio-auth y de la clave interna entre servicios."""

import secrets
from typing import Annotated

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

bearer = HTTPBearer(auto_error=False)


class UsuarioToken(BaseModel):
    id: int
    username: str
    rol: str  # admin | cliente
    token: str  # token crudo, por si hay que reenviarlo a otro servicio


def _decodificar(token: str) -> UsuarioToken:
    """Valida el JWT sin llamar a servicio-auth (basta con compartir JWT_SECRET)."""
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión expiró, vuelve a iniciar sesión")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    return UsuarioToken(
        id=int(payload["sub"]),
        username=payload.get("username", ""),
        rol=payload.get("role", ""),
        token=token,
    )


def require_usuario(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UsuarioToken:
    """Cualquier usuario con sesión (administrador o cliente)."""
    if creds is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Falta el token de acceso",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _decodificar(creds.credentials)


def require_admin(usuario: Annotated[UsuarioToken, Depends(require_usuario)]) -> UsuarioToken:
    if usuario.rol != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo administradores")
    return usuario


def usuario_opcional(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UsuarioToken | None:
    """Para endpoints públicos que hacen algo más si hay sesión. Un token inválido se rechaza."""
    return _decodificar(creds.credentials) if creds else None


def require_internal_key(
    x_internal_key: Annotated[str | None, Header()] = None,
) -> None:
    """Para llamadas servicio-a-servicio (el navegador nunca la usa)."""
    if not x_internal_key or not secrets.compare_digest(x_internal_key, settings.internal_api_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Clave interna inválida")


Admin = Annotated[UsuarioToken, Depends(require_admin)]
UsuarioActual = Annotated[UsuarioToken, Depends(require_usuario)]
UsuarioOpcional = Annotated[UsuarioToken | None, Depends(usuario_opcional)]
