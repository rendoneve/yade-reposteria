"""Límites del gateway: tamaño del cuerpo e IP del cliente."""

import importlib.util
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

RAIZ = Path(__file__).resolve().parents[1] / "servicio-gateway"


@pytest.fixture()
def gw():
    for m in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[m]
    sys.path.insert(0, str(RAIZ))
    try:
        import app.main as principal  # noqa: PLC0415

        return principal
    finally:
        sys.path.remove(str(RAIZ))


def test_cuerpo_grande_se_rechaza_con_413(gw):
    with TestClient(gw.app) as cliente:
        r = cliente.post("/api/productos", content=b"x" * (gw.settings.max_cuerpo_bytes + 1))
        assert r.status_code == 413


def test_imagenes_admite_cuerpos_mas_grandes(gw):
    with TestClient(gw.app) as cliente:
        r = cliente.post("/api/imagenes", content=b"x" * (gw.settings.max_cuerpo_bytes + 1))
        assert r.status_code != 413  # pasa el gateway (el servicio, apagado, responde 503)


def test_recurso_desconocido(gw):
    with TestClient(gw.app) as cliente:
        assert cliente.get("/api/nada").status_code == 404


def test_ip_usa_la_ultima_entrada_de_x_forwarded_for(gw, monkeypatch):
    monkeypatch.setattr(gw.settings, "confiar_x_forwarded_for", True)

    class Peticion:
        headers = {"x-forwarded-for": "1.2.3.4, 9.9.9.9"}
        client = None

    assert gw._ip(Peticion()) == "9.9.9.9"
