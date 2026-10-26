"""Subida de imágenes a un bucket compatible con S3 (p. ej. Neon Object Storage)."""

import uuid
from functools import cache

import boto3
from botocore.config import Config

from app.core.config import settings


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
