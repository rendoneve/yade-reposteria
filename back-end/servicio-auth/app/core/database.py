"""Conexión a PostgreSQL (Neon).

Usamos SQLAlchemy en modo síncrono con el driver pg8000, que es 100 % Python:
se instala en cualquier versión de Python (incluida la 3.15) sin compilar nada.
FastAPI ejecuta los endpoints `def` en un hilo aparte, así que no se bloquea.
"""

import ssl
from collections.abc import Iterator

from sqlalchemy import MetaData, create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

# Cada servicio es dueño de un schema y solo toca sus propias tablas.
SCHEMA = "auth"


def _crear_engine(raw_url: str):
    """Acepta la cadena de Neon tal cual (postgresql://...?sslmode=require&channel_binding=require)
    y la adapta a pg8000, que no entiende esos parámetros en la URL."""
    url = make_url(raw_url)
    query = dict(url.query)
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)

    connect_args: dict = {}
    if url.drivername in ("postgresql", "postgres", "postgresql+pg8000"):
        url = url.set(drivername="postgresql+pg8000", query=query)
        if sslmode and sslmode != "disable":
            connect_args["ssl_context"] = ssl.create_default_context()

    return create_engine(
        url,
        connect_args=connect_args,
        pool_pre_ping=True,  # Neon suspende el cómputo por inactividad y corta conexiones
        pool_recycle=300,
        pool_size=5,
        max_overflow=5,
    )


engine = _crear_engine(settings.database_url)
SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA)


# No hay migraciones: estos cambios se aplican al arrancar el servicio.
# Se pueden repetir sin problema y nunca borran datos.
ACTUALIZACIONES = [
    # Además de administradores, ahora hay clientes que se registran desde el sitio
    "ALTER TABLE auth.usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check",
    "ALTER TABLE auth.usuarios ADD CONSTRAINT usuarios_rol_check CHECK (rol IN ('admin', 'cliente'))",
]


def actualizar_tablas() -> None:
    """Aplica los cambios en auth.usuarios en bases creadas con una versión anterior de schema.sql."""
    with engine.begin() as conn:
        for sentencia in ACTUALIZACIONES:
            conn.execute(text(sentencia))


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
