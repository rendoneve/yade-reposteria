"""API Gateway: única puerta de entrada para el front-end.

    /api/<recurso>/...  ->  servicio dueño de ese recurso

    auth, usuarios                            -> servicio-auth
    categorias, productos, etiquetas, resenas,
    imagenes                                  -> servicio-catalogo
    citas                                     -> servicio-citas
    negocio, horarios                         -> servicio-negocio
    actividades, estadisticas                 -> servicio-actividad
"""

import asyncio
import logging
import time
from collections import deque
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.config import settings

log = logging.getLogger("uvicorn.error")

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
    "imagenes": "catalogo",
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
# Se pueden repetir sin riesgo: no cambian nada en el servidor
IDEMPOTENTES = {"GET", "HEAD"}

# (método, recurso, resto) -> (máximo de peticiones, ventana en segundos)
LIMITES = {
    ("POST", "auth", "login"): (settings.limite_login_por_minuto, 60),
    ("POST", "auth", "registro"): (settings.limite_registros_por_hora, 3600),
    ("POST", "citas", ""): (settings.limite_citas_por_hora, 3600),
}
_intentos: dict[tuple[str, str, str, str], deque[float]] = {}


def _ip(request: Request) -> str:
    if settings.confiar_x_forwarded_for and (reenviada := request.headers.get("x-forwarded-for")):
        # La última IP es la que añadió NUESTRO proxy; las anteriores las puede escribir el cliente.
        return reenviada.split(",")[-1].strip()
    return request.client.host if request.client else "desconocida"


def _revisar_limite(request: Request, recurso: str, resto: str) -> None:
    """Ventana deslizante en memoria: frena fuerza bruta en el login y spam de citas/cuentas."""
    regla = LIMITES.get((request.method, recurso, resto.strip("/")))
    if not regla or regla[0] <= 0:
        return
    maximo, ventana = regla
    ahora = time.monotonic()
    clave = (_ip(request), request.method, recurso, resto)
    marcas = _intentos.setdefault(clave, deque())
    while marcas and ahora - marcas[0] >= ventana:
        marcas.popleft()
    if len(marcas) >= maximo:
        espera = int(ventana - (ahora - marcas[0])) + 1
        cuanto = f"{espera} segundos" if espera < 60 else f"{-(-espera // 60)} minutos"
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            f"Demasiados intentos. Espera {cuanto} y vuelve a intentar.",
            headers={"Retry-After": str(espera)},
        )
    marcas.append(ahora)
    if len(_intentos) > 10_000:  # limpieza ocasional de IPs que ya no tienen intentos recientes
        for k in [k for k, v in _intentos.items() if not v or ahora - v[-1] >= 3600]:
            _intentos.pop(k, None)


async def _leer_cuerpo(request: Request, recurso: str) -> bytes:
    """Lee el cuerpo con tope de tamaño: se corta en cuanto se pasa, sin cargarlo completo."""
    maximo = settings.max_cuerpo_imagenes_bytes if recurso == "imagenes" else settings.max_cuerpo_bytes
    demasiado = HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "El contenido enviado es demasiado grande")
    declarado = request.headers.get("content-length")
    if declarado and declarado.isdigit() and int(declarado) > maximo:
        raise demasiado
    partes: list[bytes] = []
    total = 0
    async for trozo in request.stream():
        total += len(trozo)
        if total > maximo:
            raise demasiado
        partes.append(trozo)
    return b"".join(partes)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # keepalive_expiry menor que el de uvicorn (5 s): no se reutiliza una conexión que el servicio ya cerró
    app.state.http = httpx.AsyncClient(
        timeout=settings.timeout, follow_redirects=False, limits=httpx.Limits(keepalive_expiry=2.0)
    )
    yield
    await app.state.http.aclose()


app = FastAPI(title="API Gateway — Repostería", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.lista_cors,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Total-Count"],  # el panel lo usa para paginar
)
# Las listas JSON pesan 70-85 % menos comprimidas
app.add_middleware(GZipMiddleware, minimum_size=1000)


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
    _revisar_limite(request, recurso, resto)

    destino = f"{SERVICIOS[servicio]}/{recurso}" + (f"/{resto}" if resto else "")
    cabeceras = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in SALTO and k.lower() != "x-internal-key"
    }
    if request.client:
        cabeceras["x-forwarded-for"] = request.client.host

    cuerpo = await _leer_cuerpo(request, recurso)
    idempotente = request.method in IDEMPOTENTES
    for intento in range(2):
        try:
            r = await request.app.state.http.request(
                request.method, destino, params=request.query_params, headers=cabeceras, content=cuerpo
            )
        except httpx.TimeoutException:
            log.warning("Timeout al reenviar %s %s a servicio-%s", request.method, request.url.path, servicio)
            raise HTTPException(status.HTTP_504_GATEWAY_TIMEOUT, f"servicio-{servicio} tardó demasiado")
        except httpx.HTTPError as exc:
            # Una escritura solo se repite si nunca llegó al servicio (ConnectError): así no se duplica
            if intento == 0 and (idempotente or isinstance(exc, httpx.ConnectError)):
                await asyncio.sleep(0.15)
                continue
            log.warning("No se pudo conectar con servicio-%s (%s %s): %s", servicio, request.method, request.url.path, exc)
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE, f"servicio-{servicio} no está disponible"
            )
        # 503 = el servicio perdió su conexión con Neon; una lectura se repite una vez con conexión nueva
        if r.status_code == 503 and idempotente and intento == 0:
            await asyncio.sleep(0.3)
            continue
        break

    return Response(
        content=r.content,
        status_code=r.status_code,
        headers={k: v for k, v in r.headers.items() if k.lower() not in NO_DEVOLVER},
    )
