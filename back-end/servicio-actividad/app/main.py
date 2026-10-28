from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from sqlalchemy import text

from app.core.database import engine
from app.core.errores import registrar_manejadores
from app.routers import actividades, estadisticas

from app.core.config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # A diferencia de los otros servicios, este no ejecuta migraciones al arrancar;
    # validar la BD aquí evita anunciarlo listo cuando sus consultas fallarían.
    with engine.connect() as conexion:
        conexion.execute(text("SELECT 1"))
    # Mantener el pool HTTP entre peticiones evita abrir conexiones nuevas al cargar el panel.
    async with httpx.AsyncClient(timeout=settings.http_timeout) as cliente:
        app.state.http = cliente
        yield


app = FastAPI(title="Servicio de actividad", version="1.0.0", lifespan=lifespan)
registrar_manejadores(app)
app.include_router(actividades.router)
app.include_router(estadisticas.router)


@app.get("/health", tags=["Salud"])
def health():
    return {"servicio": "actividad", "estado": "ok"}
