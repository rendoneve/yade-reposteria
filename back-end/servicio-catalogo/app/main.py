from fastapi import FastAPI

from app.core.errores import registrar_manejadores
from app.routers import categorias, etiquetas, productos, resenas

app = FastAPI(title="Servicio de catálogo", version="1.0.0")
registrar_manejadores(app)
app.include_router(categorias.router)
app.include_router(productos.router)
app.include_router(etiquetas.router)
app.include_router(resenas.router)


@app.get("/health", tags=["Salud"])
def health():
    return {"servicio": "catalogo", "estado": "ok"}
