"""Caché en memoria para lo público que casi no cambia (categorías, etiquetas, listas de productos).

Así la mayoría de las visitas al sitio no tocan Neon. Se vacía en cuanto el administrador
cambia algo del catálogo, y además caduca sola (TTL) por si el servicio corre con varios procesos.
"""

import threading
import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")

TTL_SEGUNDOS = 60.0
_datos: dict[str, tuple[float, object]] = {}
_candado = threading.Lock()


def obtener(clave: str, cargar: Callable[[], T]) -> T:
    ahora = time.monotonic()
    with _candado:
        guardado = _datos.get(clave)
    if guardado and ahora - guardado[0] < TTL_SEGUNDOS:
        return guardado[1]  # type: ignore[return-value]
    valor = cargar()
    with _candado:
        _datos[clave] = (ahora, valor)
    return valor


def limpiar() -> None:
    with _candado:
        _datos.clear()
