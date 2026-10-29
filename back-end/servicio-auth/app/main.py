import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import repository as repo
from app.core.config import settings
from app.core.database import SessionLocal, actualizar_tablas
from app.core.errores import registrar_manejadores
from app.core.passwords import hash_password
from app.models import Usuario
from app.routers import auth, usuarios

log = logging.getLogger("uvicorn.error")


def crear_admin_inicial() -> None:
    """Si la tabla de usuarios está vacía y ADMIN_USERNAME/ADMIN_PASSWORD están en el .env,
    crea el primer administrador. Después de eso ya no hace nada."""
    if not (settings.admin_username and settings.admin_password):
        return
    with SessionLocal() as db:
        if repo.contar(db) > 0:
            return
        db.add(
            Usuario(
                nombre_completo=settings.admin_nombre,
                username=settings.admin_username,
                correo=settings.admin_correo,
                password_hash=hash_password(settings.admin_password),
                rol="admin",
            )
        )
        db.commit()
        log.info("Administrador inicial '%s' creado", settings.admin_username)


@asynccontextmanager
async def lifespan(app: FastAPI):
    actualizar_tablas()
    try:
        crear_admin_inicial()
    except Exception:  # la BD puede estar dormida; el servicio arranca igual
        log.exception("No se pudo revisar/crear el administrador inicial")
    yield


app = FastAPI(title="Servicio de autenticación", version="1.0.0", lifespan=lifespan)
registrar_manejadores(app)
app.include_router(auth.router)
app.include_router(usuarios.router)


@app.get("/health", tags=["Salud"])
def health():
    return {"servicio": "auth", "estado": "ok"}
