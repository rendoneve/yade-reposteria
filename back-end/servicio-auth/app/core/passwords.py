"""Hash de contraseñas con PBKDF2-SHA256 (librería estándar de Python, sin dependencias).

Formato guardado: pbkdf2_sha256$<iteraciones>$<sal_b64>$<hash_b64>
"""

import base64
import hashlib
import hmac
import secrets

ALGORITMO = "pbkdf2_sha256"
ITERACIONES = 600_000  # recomendación de OWASP para PBKDF2-SHA256


def _b64(b: bytes) -> str:
    return base64.b64encode(b).decode()


def _unb64(s: str) -> bytes:
    return base64.b64decode(s)


def hash_password(password: str) -> str:
    sal = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), sal, ITERACIONES)
    return f"{ALGORITMO}${ITERACIONES}${_b64(sal)}${_b64(dk)}"


def verificar_password(password: str, guardado: str) -> bool:
    try:
        algoritmo, iteraciones, sal, esperado = guardado.split("$")
        if algoritmo != ALGORITMO:
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), _unb64(sal), int(iteraciones))
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk, _unb64(esperado))


# Hash de relleno: se usa cuando el usuario no existe para que el login tarde lo mismo
# y no se pueda adivinar qué usuarios existen midiendo el tiempo de respuesta.
HASH_FALSO = hash_password(secrets.token_hex(16))
