from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.database import actualizar_tablas
from app.core.errores import registrar_manejadores
from app.routers import categorias, etiquetas, imagenes, productos, resenas

@asynccontextmanager
async def lifespan(app: FastAPI):
    actualizar_tablas()
    yield


app = FastAPI(lifespan=lifespan, title="Servicio de catálogo", version="1.0.0")
registrar_manejadores(app)
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(etiquetas.router)
app.include_router(resenas.router)
app.include_router(imagenes.router)


@app.get("/health", tags=["Salud"])
def health():
    return {"servicio": "catalogo", "estado": "ok"}
