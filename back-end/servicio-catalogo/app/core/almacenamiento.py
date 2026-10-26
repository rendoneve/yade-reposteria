"""Subida de imágenes a un bucket compatible con S3."""

import uuid
from functools import cache

import boto3

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
