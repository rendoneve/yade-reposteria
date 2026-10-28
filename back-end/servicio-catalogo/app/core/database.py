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
SCHEMA = "catalogo"


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
    # Las reseñas pasan de un solo producto (producto_id) a varios (resena_producto)
    # y pueden venir de un cliente con cuenta, ligadas a la cita que reseña.
    """CREATE TABLE IF NOT EXISTS catalogo.resena_producto (
        resena_id   INTEGER NOT NULL REFERENCES catalogo.resenas (id) ON DELETE CASCADE,
        producto_id INTEGER NOT NULL REFERENCES catalogo.productos (id) ON DELETE CASCADE,
        PRIMARY KEY (resena_id, producto_id)
    )""",
    """DO $$
    BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'catalogo' AND table_name = 'resenas'
                     AND column_name = 'producto_id') THEN
            INSERT INTO catalogo.resena_producto (resena_id, producto_id)
                SELECT id, producto_id FROM catalogo.resenas
            ON CONFLICT DO NOTHING;
            ALTER TABLE catalogo.resenas DROP COLUMN producto_id;
        END IF;
    END $$""",
    "ALTER TABLE catalogo.resenas ADD COLUMN IF NOT EXISTS usuario_id INTEGER",
    "ALTER TABLE catalogo.resenas ADD COLUMN IF NOT EXISTS cita_id INTEGER",
    "CREATE UNIQUE INDEX IF NOT EXISTS ux_resenas_cita ON catalogo.resenas (cita_id)",
    "CREATE INDEX IF NOT EXISTS ix_resenas_usuario ON catalogo.resenas (usuario_id)",
    "CREATE INDEX IF NOT EXISTS ix_resena_producto_producto ON catalogo.resena_producto (producto_id)",
    "DROP INDEX IF EXISTS catalogo.ix_resenas_producto",
]


def actualizar_tablas() -> None:
    """Aplica los cambios en el schema catalogo en bases creadas con una versión anterior de schema.sql."""
    with engine.begin() as conn:
        for sentencia in ACTUALIZACIONES:
            conn.execute(text(sentencia))


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
