from fastapi import FastAPI

from app.core.errores import registrar_manejadores
from app.routers import negocio

app = FastAPI(title="Servicio de negocio", version="1.0.0")
registrar_manejadores(app)
app.include_router(negocio.router)


@app.get("/health", tags=["Salud"])
def health():
    return {"servicio": "negocio", "estado": "ok"}
