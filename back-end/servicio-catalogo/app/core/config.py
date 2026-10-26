from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICIO_DIR = Path(__file__).resolve().parents[2]  # back-end/servicio-catalogo


class Settings(BaseSettings):
    # Lee back-end/.env (compartido por todos los servicios) y luego servicio-catalogo/.env,
    # que es opcional y tiene prioridad. Las variables de entorno ganan sobre ambos.
    model_config = SettingsConfigDict(
        env_file=(SERVICIO_DIR.parent / ".env", SERVICIO_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    internal_api_key: str  # clave para llamadas entre servicios
    actividad_service_url: str = "http://127.0.0.1:8005"

    # Bucket de imágenes (cualquier almacenamiento compatible con S3).
    # Mientras S3_BUCKET esté vacío, POST /imagenes responde 503.
    s3_endpoint_url: str = ""  # vacío = AWS S3
    s3_region: str = "auto"
    s3_bucket: str = ""
    s3_access_key_id: str = ""
    s3_secret_access_key: str = ""
    s3_public_url: str = ""  # URL pública del bucket; las imágenes quedan en <s3_public_url>/<clave>
    s3_prefijo: str = "imagenes"

settings = Settings()
