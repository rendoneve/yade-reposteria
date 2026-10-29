import logging
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from sqlalchemy import text

from app.core.database import engine
from app.core.errores import registrar_manejadores
from app.routers import actividades, estadisticas

from app.core.config import settings

log = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Abre la primera conexión (y despierta a Neon) antes de la primera visita al panel.
    # Si la BD no responde, el servicio arranca igual y lo reintenta en la siguiente petición.
    try:
        with engine.connect() as conexion:
            conexion.execute(text("SELECT 1"))
    except Exception as exc:  # noqa: BLE001 - solo es un calentamiento
        log.warning("La base de datos no respondió al arrancar: %s", exc)
    # Mantener el pool HTTP entre peticiones evita abrir conexiones nuevas al cargar el panel.
    async with httpx.AsyncClient(
        timeout=settings.http_timeout, limits=httpx.Limits(keepalive_expiry=2.0)
    ) as cliente:
        app.state.http = cliente
        yield


app = FastAPI(title="Servicio de actividad", version="1.0.0", lifespan=lifespan)
registrar_manejadores(app)
app.include_router(actividades.router)
app.include_router(estadisticas.router)


@app.get("/health", tags=["Salud"])
def health():
    return {"servicio": "actividad", "estado": "ok"}
