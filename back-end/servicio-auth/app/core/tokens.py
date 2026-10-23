from datetime import UTC, datetime, timedelta

import jwt

from app.core.config import settings
from app.models import Usuario


def crear_token(usuario: Usuario) -> tuple[str, int]:
    """Devuelve (token, segundos de vigencia). Los demás servicios lo verifican con JWT_SECRET."""
    segundos = settings.jwt_expire_minutes * 60
    ahora = datetime.now(UTC)
    payload = {
        "sub": str(usuario.id),
        "username": usuario.username,
        "role": usuario.rol,
        "iat": ahora,
        "exp": ahora + timedelta(seconds=segundos),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm), segundos
