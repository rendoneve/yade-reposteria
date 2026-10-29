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
        env_ignore_empty=True,  # una línea vacía en el .env usa el valor por defecto
    )

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    internal_api_key: str  # clave para llamadas entre servicios
    actividad_service_url: str = "http://127.0.0.1:8005"
    catalogo_service_url: str = "http://127.0.0.1:8002"
    negocio_service_url: str = "http://127.0.0.1:8004"

    # Agenda: cuánto dura cada cita y cuántas pueden atenderse a la misma hora.
    # Con estos valores se calculan las horas disponibles y se evitan citas encimadas.
    duracion_cita_minutos: int = 30
    citas_simultaneas: int = 1
    zona_horaria: str = "America/Mazatlan"  # hora local del negocio
    dias_maximos_agenda: int = 180  # hasta cuántos días adelante se puede agendar

settings = Settings()
