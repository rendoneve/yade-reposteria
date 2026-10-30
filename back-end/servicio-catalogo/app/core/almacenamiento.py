"""Subida de imágenes a un bucket compatible con S3 (p. ej. Neon Object Storage)."""

import logging
import uuid
from functools import cache

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import settings

log = logging.getLogger(__name__)


def configurado() -> bool:
    return bool(settings.s3_bucket and settings.s3_public_url)


@cache
def _cliente():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id or None,
        aws_secret_access_key=settings.s3_secret_access_key or None,
        config=Config(
            signature_version="s3v4",
            # Neon (y la mayoría de los S3 compatibles) solo acepta rutas tipo <endpoint>/<bucket>/<clave>
            s3={"addressing_style": "path"},
            # boto3 >= 1.36 agrega sumas de verificación CRC32 a cada subida; varios S3 compatibles
            # las rechazan. Solo se envían cuando la operación las exige.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
            connect_timeout=5,
            read_timeout=30,
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )


def subir(contenido: bytes, content_type: str, extension: str) -> str:
    """Guarda el archivo con un nombre único y devuelve su URL pública."""
    clave = f"{settings.s3_prefijo.strip('/')}/{uuid.uuid4().hex}.{extension}".lstrip("/")
    _cliente().put_object(
        Bucket=settings.s3_bucket,
        Key=clave,
        Body=contenido,
        ContentType=content_type,
        CacheControl="public, max-age=31536000, immutable",
    )
    return f"{settings.s3_public_url.rstrip('/')}/{clave}"


def clave_de(url: str | None) -> str | None:
    """Clave del archivo en el bucket si la URL es una imagen subida por este sistema; si no, None."""
    if not url or not configurado():
        return None
    base = settings.s3_public_url.rstrip("/") + "/"
    prefijo = settings.s3_prefijo.strip("/")
    if not url.startswith(base):
        return None
    clave = url[len(base):]
    return clave if clave.startswith(f"{prefijo}/") and ".." not in clave else None


def borrar(url: str | None) -> None:
    """Quita del bucket una imagen que ya no usa nadie. Se llama en segundo plano; si falla solo se avisa."""
    clave = clave_de(url)
    if clave is None:
        return
    try:
        _cliente().delete_object(Bucket=settings.s3_bucket, Key=clave)
    except (BotoCoreError, ClientError) as exc:
        log.warning("No se pudo borrar la imagen %s del bucket: %s", clave, exc)
