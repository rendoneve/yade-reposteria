"""API Gateway: única puerta de entrada para el front-end.

    /api/<recurso>/...  ->  servicio dueño de ese recurso

    auth, usuarios                            -> servicio-auth
    categorias, productos, etiquetas, resenas -> servicio-catalogo
    citas                                     -> servicio-citas
    negocio, horarios                         -> servicio-negocio
    actividades, estadisticas                 -> servicio-actividad
"""

import asyncio
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

SERVICIOS = {
    "auth": settings.auth_service_url,
    "catalogo": settings.catalogo_service_url,
    "citas": settings.citas_service_url,
    "negocio": settings.negocio_service_url,
    "actividad": settings.actividad_service_url,
}

RUTAS = {
    "auth": "auth",
    "usuarios": "auth",
    "categorias": "catalogo",
    "productos": "catalogo",
    "etiquetas": "catalogo",
    "resenas": "catalogo",
    "citas": "citas",
    "negocio": "negocio",
    "horarios": "negocio",
    "actividades": "actividad",
    "estadisticas": "actividad",
}

# Cabeceras que no se deben reenviar tal cual (son de la conexión, no del mensaje)
SALTO = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te",
    "trailers", "transfer-encoding", "upgrade", "host", "content-length",
}
NO_DEVOLVER = SALTO | {"content-encoding"}


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.http = httpx.AsyncClient(timeout=settings.timeout, follow_redirects=False)
    yield
    await app.state.http.aclose()


app = FastAPI(title="API Gateway — Repostería", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.lista_cors,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["Salud"])
async def health(request: Request):
    """Estado de cada servicio."""

    async def revisar(nombre: str, url: str) -> tuple[str, str]:
        try:
            r = await request.app.state.http.get(f"{url}/health", timeout=3.0)
            return nombre, "ok" if r.status_code == 200 else f"error {r.status_code}"
        except httpx.HTTPError:
            return nombre, "no disponible"

    resultados = dict(await asyncio.gather(*(revisar(n, u) for n, u in SERVICIOS.items())))
    todo_ok = all(v == "ok" for v in resultados.values())
    return {"gateway": "ok", "servicios": resultados, "todo_ok": todo_ok}


METODOS = ["GET", "POST", "PUT", "PATCH", "DELETE"]


@app.api_route("/api/{recurso}", methods=METODOS, include_in_schema=False)
async def proxy_raiz(recurso: str, request: Request):
    return await _reenviar(request, recurso, "")


@app.api_route("/api/{recurso}/{resto:path}", methods=METODOS, include_in_schema=False)
async def proxy(recurso: str, resto: str, request: Request):
    return await _reenviar(request, recurso, resto)


async def _reenviar(request: Request, recurso: str, resto: str) -> Response:
    if ".." in resto.split("/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ruta no válida")
    servicio = RUTAS.get(recurso)
    if servicio is None:
        if recurso in SERVICIOS:  # p. ej. /api/catalogo/productos
            sugeridos = ", ".join(f"/api/{r}" for r, s in RUTAS.items() if s == recurso)
            raise HTTPException(
                status.HTTP_404_NOT_FOUND,
                f"'{recurso}' es el nombre del servicio; no va en la URL. Usa: {sugeridos}",
            )
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Recurso desconocido: {recurso}")

    # Registrar actividades es solo entre servicios; desde afuera únicamente se consulta.
    if recurso == "actividades" and request.method != "GET":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Operación no permitida")

    destino = f"{SERVICIOS[servicio]}/{recurso}" + (f"/{resto}" if resto else "")
    cabeceras = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in SALTO and k.lower() != "x-internal-key"
    }
    if request.client:
        cabeceras["x-forwarded-for"] = request.client.host

    try:
        r = await request.app.state.http.request(
            request.method,
            destino,
            params=request.query_params,
            headers=cabeceras,
            content=await request.body(),
        )
    except httpx.TimeoutException:
        raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT, f"servicio-{servicio} tardó demasiado")
    except httpx.HTTPError:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, f"servicio-{servicio} no está disponible"
        )

    return Response(
        content=r.content,
        status_code=r.status_code,
        headers={k: v for k, v in r.headers.items() if k.lower() not in NO_DEVOLVER},
    )
