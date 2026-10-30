from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICIO_DIR = Path(__file__).resolve().parents[2]  # back-end/servicio-actividad


class Settings(BaseSettings):
    # Lee back-end/.env (compartido por todos los servicios) y luego servicio-actividad/.env,
    # que es opcional y tiene prioridad. Las variables de entorno ganan sobre ambos.
    model_config = SettingsConfigDict(
        env_file=(SERVICIO_DIR.parent / ".env", SERVICIO_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,  # una línea vacía en el .env usa el valor por defecto
    )

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    internal_api_key: str  # clave para llamadas entre servicios
    auth_service_url: str = "http://127.0.0.1:8001"  # para comprobar que la cuenta sigue activa
    # Servicios a los que se les piden datos para las estadísticas
    catalogo_service_url: str = "http://127.0.0.1:8002"
    citas_service_url: str = "http://127.0.0.1:8003"
    http_timeout: float = 10.0

settings = Settings()
