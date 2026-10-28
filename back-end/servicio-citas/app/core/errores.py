"""Convierte errores de la base de datos en respuestas HTTP entendibles."""

import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError, InterfaceError, OperationalError

log = logging.getLogger(__name__)


def registrar_manejadores(app: FastAPI) -> None:
    @app.exception_handler(IntegrityError)
    async def _integridad(request: Request, exc: IntegrityError):
        codigo = getattr(getattr(exc, "orig", None), "sqlstate", None) or _sqlstate(exc)
        if codigo == "23505":
            msg = "Ya existe un registro con ese valor"
        elif codigo == "23503":
            msg = "El registro está relacionado con otros datos"
        elif codigo == "23514":
            msg = "Algún valor no está permitido"
        else:
            msg = "Los datos no son válidos para la base de datos"
        return JSONResponse(status_code=409, content={"detail": msg})

    @app.exception_handler(OperationalError)
    async def _bd_caida(request: Request, exc: OperationalError):
        log.exception("Error de conexión con la base de datos")
        return JSONResponse(
            status_code=503, content={"detail": "No se pudo conectar con la base de datos"}
        )

    @app.exception_handler(InterfaceError)
    async def _conexion_reiniciada(request: Request, exc: InterfaceError):
        log.warning("Conexión de base de datos reiniciada durante la solicitud: %s", exc)
        return JSONResponse(
            status_code=503, content={"detail": "La base de datos se está reconectando. Intenta de nuevo."}
        )


def _sqlstate(exc: Exception) -> str | None:
    """pg8000 guarda el código SQLSTATE en args[0]['C']."""
    orig = getattr(exc, "orig", None)
    args = getattr(orig, "args", None)
    if args and isinstance(args[0], dict):
        return args[0].get("C")
    return None
