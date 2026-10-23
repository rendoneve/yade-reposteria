from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICIO_DIR = Path(__file__).resolve().parents[1]  # back-end/servicio-gateway


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(SERVICIO_DIR.parent / ".env", SERVICIO_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    auth_service_url: str = "http://127.0.0.1:8001"
    catalogo_service_url: str = "http://127.0.0.1:8002"
    citas_service_url: str = "http://127.0.0.1:8003"
    negocio_service_url: str = "http://127.0.0.1:8004"
    actividad_service_url: str = "http://127.0.0.1:8005"

    # Orígenes del front-end que pueden llamar a la API (separados por coma en el .env)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    timeout: float = 15.0

    @property
    def lista_cors(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
