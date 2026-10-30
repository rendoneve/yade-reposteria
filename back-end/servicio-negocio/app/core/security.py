"""Verificación del JWT que emite servicio-auth y de la clave interna entre servicios.

El JWT se valida con JWT_SECRET (sin llamar a servicio-auth), pero además se confirma que la cuenta
sigue activa y con el mismo rol. Esa comprobación se guarda 15 s en memoria: un usuario desactivado,
eliminado o degradado pierde el acceso en segundos y no al vencer su token (2 h).
Si servicio-auth no responde se usa el último estado conocido; si nunca se conoció, se confía en el token.
"""

import logging
import secrets
import threading
import time
from typing import Annotated

import httpx
import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

log = logging.getLogger(__name__)
bearer = HTTPBearer(auto_error=False)

TTL_CUENTA = 15.0
_cuentas: dict[int, tuple[float, dict | None]] = {}
_candado = threading.Lock()
_DESCONOCIDA: dict = {}  # no se pudo consultar: se confía en el token

_http = httpx.Client(
    base_url=settings.auth_service_url,
    headers={"X-Internal-Key": settings.internal_api_key},
    timeout=3.0,
    limits=httpx.Limits(keepalive_expiry=2.0),  # menor que el de uvicorn (5 s)
)


def _consultar_cuenta(usuario_id: int) -> dict | None:
    r = _http.get(f"/auth/interno/{usuario_id}")
    if r.status_code == 404:
        return None
    r.raise_for_status()
    return r.json()


class UsuarioToken(BaseModel):
    id: int
    username: str
    rol: str  # admin | cliente
    token: str  # token crudo, por si hay que reenviarlo a otro servicio


def invalidar_cuenta(usuario_id: int) -> None:
    """Olvida lo guardado de una cuenta (se llama cuando cambia o se elimina)."""
    with _candado:
        _cuentas.pop(usuario_id, None)


def _cuenta(usuario_id: int) -> dict | None:
    """{'activo': bool, 'rol': str}, None si la cuenta ya no existe, o {} si no se pudo consultar."""
    ahora = time.monotonic()
    with _candado:
        guardado = _cuentas.get(usuario_id)
    if guardado and ahora - guardado[0] < TTL_CUENTA:
        return guardado[1]
    try:
        datos = _consultar_cuenta(usuario_id)
    except httpx.HTTPError as exc:
        log.warning("No se pudo comprobar la cuenta %s: %s", usuario_id, exc)
        return guardado[1] if guardado else _DESCONOCIDA
    with _candado:
        if len(_cuentas) > 2000:  # limpieza ocasional de cuentas que ya no se consultan
            for k in [k for k, (t, _) in _cuentas.items() if ahora - t >= TTL_CUENTA]:
                _cuentas.pop(k, None)
        _cuentas[usuario_id] = (ahora, datos)
    return datos


def _decodificar(token: str) -> UsuarioToken:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión expiró, vuelve a iniciar sesión")
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token inválido")
    usuario_id = int(payload["sub"])
    rol = payload.get("role", "")
    cuenta = _cuenta(usuario_id)
    if cuenta is None or cuenta.get("activo") is False:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La cuenta ya no está activa")
    rol = cuenta.get("rol") or rol  # el rol vigente manda sobre el del token
    return UsuarioToken(id=usuario_id, username=payload.get("username", ""), rol=rol, token=token)


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
