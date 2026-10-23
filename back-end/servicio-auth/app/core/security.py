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
    token: str  # token crudo, por si hay que reenviarlo a otro servicio


def require_admin(
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> UsuarioToken:
    """Valida el JWT sin llamar a servicio-auth (basta con compartir JWT_SECRET)."""
    if creds is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Falta el token de acceso",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            creds.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm]
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión expiró, vuelve a iniciar sesión")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    if payload.get("role") != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Solo administradores")
    return UsuarioToken(
        id=int(payload["sub"]), username=payload.get("username", ""), token=creds.credentials
    )


def require_internal_key(
    x_internal_key: Annotated[str | None, Header()] = None,
) -> None:
    """Para llamadas servicio-a-servicio (el navegador nunca la usa)."""
    if not x_internal_key or not secrets.compare_digest(x_internal_key, settings.internal_api_key):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Clave interna inválida")


Admin = Annotated[UsuarioToken, Depends(require_admin)]
