from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICIO_DIR = Path(__file__).resolve().parents[2]  # back-end/servicio-citas


class Settings(BaseSettings):
    # Lee back-end/.env (compartido por todos los servicios) y luego servicio-citas/.env,
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

settings = Settings()
