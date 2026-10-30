from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

SERVICIO_DIR = Path(__file__).resolve().parents[1]  # back-end/servicio-gateway


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(SERVICIO_DIR.parent / ".env", SERVICIO_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        env_ignore_empty=True,  # una línea vacía en el .env usa el valor por defecto
    )

    auth_service_url: str = "http://127.0.0.1:8001"
    catalogo_service_url: str = "http://127.0.0.1:8002"
    citas_service_url: str = "http://127.0.0.1:8003"
    negocio_service_url: str = "http://127.0.0.1:8004"
    actividad_service_url: str = "http://127.0.0.1:8005"

    # Orígenes del front-end que pueden llamar a la API (separados por coma en el .env)
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    timeout: float = 15.0

    # Límite de intentos por IP en login, registro y citas públicas (0 = sin límite).
    limite_login_por_minuto: int = 10
    limite_registros_por_hora: int = 5
    limite_citas_por_hora: int = 10
    # Detrás de un proxy (Nginx, Render, Railway…) la IP real viene en X-Forwarded-For.
    # Actívalo solo si el gateway NO está expuesto directo a internet.
    confiar_x_forwarded_for: bool = False

    # Tamaño máximo del cuerpo de una petición (bytes). El gateway lo lee completo antes de
    # reenviarlo, así que sin tope cualquiera podría llenarle la memoria. Las imágenes tienen el suyo.
    max_cuerpo_bytes: int = 256 * 1024
    max_cuerpo_imagenes_bytes: int = 6 * 1024 * 1024  # el servicio de catálogo acepta 5 MB por imagen

    @property
    def lista_cors(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
