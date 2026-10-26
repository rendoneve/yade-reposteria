import logging

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, HTTPException, UploadFile, status
from pydantic import BaseModel

from app.core import almacenamiento
from app.core.security import Admin

router = APIRouter(prefix="/imagenes", tags=["Imágenes"])
log = logging.getLogger("uvicorn.error")

TIPOS = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif"}
MAX_BYTES = 5 * 1024 * 1024


class ImagenOut(BaseModel):
    url: str


@router.post("", response_model=ImagenOut, status_code=status.HTTP_201_CREATED)
def subir_imagen(archivo: UploadFile, admin: Admin):
    """Sube una imagen al bucket y devuelve su URL (para usarla en `imagen_url`)."""
    if not almacenamiento.configurado():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "El almacenamiento de imágenes no está configurado (revisa S3_* en back-end/.env)",
        )
    extension = TIPOS.get(archivo.content_type or "")
    if extension is None:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Formato no permitido. Usa JPG, PNG, WEBP, GIF o AVIF"
        )
    contenido = archivo.file.read(MAX_BYTES + 1)
    if len(contenido) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "La imagen pesa más de 5 MB")
    try:
        url = almacenamiento.subir(contenido, archivo.content_type, extension)
    except ClientError as exc:
        # El bucket respondió con un error (credenciales, bucket inexistente, permisos…)
        error = exc.response.get("Error", {})
        codigo = error.get("Code", "desconocido")
        log.warning("El bucket rechazó la imagen: %s - %s", codigo, error.get("Message", ""))
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"El bucket rechazó la imagen ({codigo})")
    except BotoCoreError as exc:
        # No se pudo ni hablar con el bucket (endpoint mal escrito, sin red, región inválida…)
        log.warning("No se pudo conectar con el bucket: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"No se pudo conectar con el bucket: {exc}")
    return ImagenOut(url=url)
