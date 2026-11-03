"""Videos: validación del archivo, límite del gateway y esquema del negocio."""

import importlib.util
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

RAIZ = Path(__file__).resolve().parents[1]


def _cargar(servicio: str, modulo: str):
    for m in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[m]
    sys.path.insert(0, str(RAIZ / servicio))
    try:
        return importlib.import_module(modulo)
    finally:
        sys.path.remove(str(RAIZ / servicio))


def test_firma_de_video_valida():
    v = _cargar("servicio-catalogo", "app.routers.videos")
    assert v._contenido_valido(b"\x00\x00\x00\x18ftypmp42" + b"0" * 20, "video/mp4")
    assert v._contenido_valido(b"\x1a\x45\xdf\xa3" + b"0" * 20, "video/webm")
    assert not v._contenido_valido(b"MZ" + b"0" * 30, "video/mp4")
    assert not v._contenido_valido(b"\x1a\x45\xdf\xa3", "video/mp4")


def test_subir_video_rechaza_formato_y_exige_admin():
    from fastapi.testclient import TestClient

    principal = _cargar("servicio-catalogo", "app.main")
    with TestClient(principal.app) as c:
        r = c.post("/videos", files={"archivo": ("a.mp4", b"x", "video/mp4")})
        assert r.status_code in (401, 403)  # sin sesión de administrador


def test_gateway_admite_videos_grandes():
    from fastapi.testclient import TestClient

    gw = _cargar("servicio-gateway", "app.main")
    with TestClient(gw.app) as c:
        r = c.post("/api/videos", content=b"x" * (gw.settings.max_cuerpo_imagenes_bytes + 1))
        assert r.status_code != 413
        r = c.post("/api/videos", content=b"x" * (gw.settings.max_cuerpo_videos_bytes + 1))
        assert r.status_code == 413


def test_esquema_negocio_valida_videos():
    s = _cargar("servicio-negocio", "app.schemas")
    ok = s.NegocioUpdate(videos=[{"url": "https://x.com/v.mp4", "ubicaciones": ["hero_inicio", "nosotros", "nosotros"]}])
    assert ok.videos[0].ubicaciones == ["hero_inicio", "nosotros"]  # varios lugares, sin repetir
    viejo = s.NegocioUpdate(videos=[{"url": "https://x.com/v.mp4", "ubicacion": "hero_acerca"}])
    assert viejo.videos[0].ubicaciones == ["hero_acerca"]  # formato anterior
    with pytest.raises(ValidationError):
        s.NegocioUpdate(videos=[{"url": "javascript:alert(1)"}])
    with pytest.raises(ValidationError):
        s.NegocioUpdate(videos=[{"url": "https://x.com/v.mp4", "ubicaciones": ["otro"]}])
    with pytest.raises(ValidationError):
        s.NegocioUpdate(videos=[{"url": "https://x.com/v.mp4"}] * 13)
