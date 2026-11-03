import logging

from botocore.exceptions import BotoCoreError, ClientError
from fastapi import APIRouter, BackgroundTasks, HTTPException, Query, UploadFile, status
from pydantic import BaseModel

from app.core import almacenamiento
from app.core.security import Admin

router = APIRouter(prefix="/videos", tags=["Videos"])
log = logging.getLogger("uvicorn.error")

TIPOS = {"video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov"}
MAX_BYTES = 40 * 1024 * 1024


def _contenido_valido(contenido: bytes, tipo: str) -> bool:
    """Comprueba la firma del formato para no fiarse solo del MIME enviado por el navegador."""
    if tipo in ("video/mp4", "video/quicktime"):
        return len(contenido) >= 12 and contenido[4:8] == b"ftyp"
    if tipo == "video/webm":
        return contenido.startswith(b"\x1a\x45\xdf\xa3")
    return False


class VideoOut(BaseModel):
    url: str


@router.post("", response_model=VideoOut, status_code=status.HTTP_201_CREATED)
def subir_video(archivo: UploadFile, admin: Admin):
    """Sube un video (MP4, WEBM o MOV, hasta 40 MB) al bucket y devuelve su URL pública."""
    if not almacenamiento.configurado():
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE,
            "El almacenamiento no está configurado (revisa S3_* en back-end/.env)",
        )
    extension = TIPOS.get(archivo.content_type or "")
    if extension is None:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Formato no permitido. Usa MP4, WEBM o MOV")
    contenido = archivo.file.read(MAX_BYTES + 1)
    if len(contenido) > MAX_BYTES:
        raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "El video pesa más de 40 MB")
    if not _contenido_valido(contenido, archivo.content_type or ""):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "El archivo no coincide con el formato declarado")
    try:
        url = almacenamiento.subir(contenido, archivo.content_type, extension)
    except ClientError as exc:
        error = exc.response.get("Error", {})
        log.warning("El bucket rechazó el video: %s - %s", error.get("Code", "desconocido"), error.get("Message", ""))
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"El bucket rechazó el video ({error.get('Code', 'desconocido')})")
    except BotoCoreError as exc:
        log.warning("No se pudo conectar con el bucket: %s", exc)
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"No se pudo conectar con el bucket: {exc}")
    return VideoOut(url=url)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def borrar_video(admin: Admin, tareas: BackgroundTasks, url: str = Query(max_length=500)):
    """Quita del bucket un video que ya no se usa (solo si lo subió este sistema)."""
    if almacenamiento.clave_de(url) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ese video no está en el almacenamiento del sitio")
    tareas.add_task(almacenamiento.borrar, url)
