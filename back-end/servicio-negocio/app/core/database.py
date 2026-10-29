"""Conexión a PostgreSQL (Neon).

Usamos SQLAlchemy en modo síncrono con el driver pg8000, que es 100 % Python:
se instala en cualquier versión de Python (incluida la 3.15) sin compilar nada.
FastAPI ejecuta los endpoints `def` en un hilo aparte, así que no se bloquea.

Cada ida y vuelta a Neon cuesta tiempo de red, así que aquí se evitan las que sobran:
  * Ping solo si la conexión estuvo ociosa más de PING_SI_OCIOSA segundos (con tráfico normal,
    ninguno). Antes se hacía en cada petición. `pool_recycle` además descarta las conexiones
    antes de que Neon suspenda el cómputo (5 min).
  * Ojo: NO usar autocommit de pg8000 para ahorrar el BEGIN/ROLLBACK. Se probó y con varias
    peticiones a la vez mezcla las respuestas entre conexiones.
"""

import logging
import ssl
import time
from collections.abc import Callable, Iterator
from typing import TypeVar

import pg8000.exceptions

from sqlalchemy import MetaData, create_engine, event, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import DBAPIError, InterfaceError, OperationalError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings

log = logging.getLogger("uvicorn.error")

# Cada servicio es dueño de un schema y solo toca sus propias tablas.
SCHEMA = "negocio"


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
        pool_pre_ping=False,
        pool_recycle=240,  # menor que la suspensión por inactividad de Neon (300 s)
        pool_size=3,
        max_overflow=5,
        pool_use_lifo=True,  # reutiliza la conexión más reciente; las ociosas envejecen y se reciclan
    )


engine = _crear_engine(settings.database_url)
SessionLocal = sessionmaker(engine, expire_on_commit=False)
PING_SI_OCIOSA = 30.0  # segundos


@event.listens_for(engine, "connect")
def _al_conectar(_dbapi_connection, registro):
    registro.info["usada"] = time.monotonic()


@event.listens_for(engine, "checkin")
def _al_devolver(_dbapi_connection, registro):
    registro.info["usada"] = time.monotonic()


class Base(DeclarativeBase):
    metadata = MetaData(schema=SCHEMA)


# No hay migraciones: estos cambios se aplican al arrancar el servicio.
# Se pueden repetir sin problema y nunca borran datos.
ACTUALIZACIONES = [
    "ALTER TABLE negocio.negocio ADD COLUMN IF NOT EXISTS nombre VARCHAR(100)",
    "ALTER TABLE negocio.negocio ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)",
    "ALTER TABLE negocio.negocio ADD COLUMN IF NOT EXISTS hero_url VARCHAR(500)",
    # Hero de la página Menú (catálogo), editable desde Configuración
    "ALTER TABLE negocio.negocio ADD COLUMN IF NOT EXISTS catalogo_url VARCHAR(500)",
    "ALTER TABLE negocio.negocio ADD COLUMN IF NOT EXISTS texto_catalogo TEXT",
]


def actualizar_tablas() -> None:
    """Aplica los cambios del schema negocio en bases creadas con una versión anterior de schema.sql.

    Primero van todas en una sola transacción (rápido: 2 viajes a Neon). Si alguna falla, se
    repiten una por una para aplicar las demás; lo que falle (o si la BD no responde al arrancar)
    se registra en el log y el servicio arranca igual."""
    try:
        with engine.begin() as conn:
            for sentencia in ACTUALIZACIONES:
                conn.execute(text(sentencia))
        return
    except Exception as exc:
        if es_desconexion(exc):
            log.warning("La BD no respondió al aplicar las actualizaciones de %s: %s", SCHEMA, exc)
            return
    for sentencia in ACTUALIZACIONES:
        try:
            with engine.begin() as conn:
                conn.execute(text(sentencia))
        except Exception as exc:
            log.warning("No se pudo aplicar una actualización de %s: %s", SCHEMA, exc)
            if es_desconexion(exc):
                return  # sin conexión: no tiene caso intentar las demás


def abrir_sesion() -> Session:
    """Sesión lista para usar, con una conexión que se sabe viva."""
    for intento in range(2):
        session = SessionLocal()
        try:
            conexion = session.connection()
            if time.monotonic() - conexion.connection.info.get("usada", 0) > PING_SI_OCIOSA:
                conexion.exec_driver_sql("SELECT 1")  # pudo cortarse mientras estaba ociosa
            return session
        except (InterfaceError, OperationalError):
            session.close()
            engine.dispose()
            if intento:
                raise
            time.sleep(0.2)
    raise RuntimeError("inalcanzable")


def es_desconexion(exc: BaseException | None) -> bool:
    """¿El error es porque se cortó la conexión con Neon? Revisa toda la cadena de excepciones
    (pg8000 a veces la envuelve en InterfaceError y otras deja pasar el BrokenPipe/ConnectionReset)."""
    vistos = 0
    while exc is not None and vistos < 10:
        if isinstance(exc, (InterfaceError, OperationalError, ConnectionError, pg8000.exceptions.InterfaceError)):
            return True
        if isinstance(exc, DBAPIError) and exc.connection_invalidated:
            return True
        exc = exc.__cause__ or exc.__context__
        vistos += 1
    return False


T = TypeVar("T")


def leer(consulta: Callable[[Session], T]) -> T:
    """Ejecuta una lectura con su propia sesión. Si Neon cortó la conexión a la mitad, la repite
    una vez con una conexión nueva: quien hizo la petición ni se entera."""
    for intento in range(2):
        try:
            with abrir_sesion() as db:
                return consulta(db)
        except Exception as exc:
            if intento or not es_desconexion(exc):
                raise
            log.warning("Neon cortó la conexión durante una lectura de %s; se reintenta", SCHEMA)
            engine.dispose()
            time.sleep(0.2)
    raise RuntimeError("inalcanzable")


def get_db() -> Iterator[Session]:
    session = abrir_sesion()
    try:
        yield session
    finally:
        session.close()
