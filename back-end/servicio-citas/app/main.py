from fastapi import FastAPI

from app.core.errores import registrar_manejadores
from app.routers import citas

app = FastAPI(title="Servicio de citas", version="1.0.0")
registrar_manejadores(app)
app.include_router(citas.router)


@app.get("/health", tags=["Salud"])
def health():
    return {"servicio": "citas", "estado": "ok"}
