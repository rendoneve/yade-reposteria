from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.database import actualizar_tablas
from app.core.errores import registrar_manejadores
from app.routers import citas


@asynccontextmanager
async def lifespan(app: FastAPI):
    actualizar_tablas()
    yield


app = FastAPI(lifespan=lifespan, title="Servicio de citas", version="1.0.0")
registrar_manejadores(app)
app.include_router(citas.router)


@app.get("/health", tags=["Salud"])
def health():
    return {"servicio": "citas", "estado": "ok"}
