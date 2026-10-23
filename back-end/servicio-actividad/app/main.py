from fastapi import FastAPI

from app.core.errores import registrar_manejadores
from app.routers import actividades, estadisticas

app = FastAPI(title="Servicio de actividad", version="1.0.0")
registrar_manejadores(app)
app.include_router(actividades.router)
app.include_router(estadisticas.router)


@app.get("/health", tags=["Salud"])
def health():
    return {"servicio": "actividad", "estado": "ok"}
