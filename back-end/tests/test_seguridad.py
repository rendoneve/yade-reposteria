"""Comprobación de cuenta activa en la verificación del JWT (servicio-catalogo)."""

import importlib.util
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pytest
from fastapi import HTTPException

RAIZ = Path(__file__).resolve().parents[1] / "servicio-catalogo"


@pytest.fixture()
def seg():
    for m in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[m]
    sys.path.insert(0, str(RAIZ))
    try:
        spec = importlib.util.spec_from_file_location("seguridad_catalogo", RAIZ / "app/core/security.py")
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
    finally:
        sys.path.remove(str(RAIZ))
    modulo._cuentas.clear()
    return modulo


def _token(seg, rol="admin", uid=7):
    ahora = datetime.now(UTC)
    payload = {"sub": str(uid), "username": "u", "role": rol, "iat": ahora, "exp": ahora + timedelta(hours=1)}
    return jwt.encode(payload, seg.settings.jwt_secret, algorithm=seg.settings.jwt_algorithm)


def test_cuenta_activa_pasa(seg, monkeypatch):
    monkeypatch.setattr(seg, "_consultar_cuenta", lambda uid: {"activo": True, "rol": "admin"})
    assert seg._decodificar(_token(seg)).rol == "admin"


def test_cuenta_desactivada_se_rechaza_aunque_el_token_sea_valido(seg, monkeypatch):
    monkeypatch.setattr(seg, "_consultar_cuenta", lambda uid: {"activo": False, "rol": "admin"})
    with pytest.raises(HTTPException) as e:
        seg._decodificar(_token(seg))
    assert e.value.status_code == 401


def test_cuenta_eliminada_se_rechaza(seg, monkeypatch):
    monkeypatch.setattr(seg, "_consultar_cuenta", lambda uid: None)
    with pytest.raises(HTTPException):
        seg._decodificar(_token(seg))


def test_el_rol_vigente_manda_sobre_el_del_token(seg, monkeypatch):
    monkeypatch.setattr(seg, "_consultar_cuenta", lambda uid: {"activo": True, "rol": "cliente"})
    usuario = seg._decodificar(_token(seg, rol="admin"))
    assert usuario.rol == "cliente"
    with pytest.raises(HTTPException) as e:
        seg.require_admin(usuario)
    assert e.value.status_code == 403


def test_si_auth_no_responde_se_confia_en_el_token(seg, monkeypatch):
    def caido(uid):
        raise seg.httpx.ConnectError("sin conexión")

    monkeypatch.setattr(seg, "_consultar_cuenta", caido)
    assert seg._decodificar(_token(seg)).rol == "admin"


def test_si_auth_cae_se_usa_el_ultimo_estado_conocido(seg, monkeypatch):
    seg._cuentas[7] = (0.0, {"activo": False, "rol": "admin"})  # guardado hace tiempo (vencido)

    def caido(uid):
        raise seg.httpx.ConnectError("sin conexión")

    monkeypatch.setattr(seg, "_consultar_cuenta", caido)
    with pytest.raises(HTTPException):
        seg._decodificar(_token(seg))


def test_invalidar_fuerza_nueva_consulta(seg, monkeypatch):
    estados = iter([{"activo": True, "rol": "admin"}, {"activo": False, "rol": "admin"}])
    monkeypatch.setattr(seg, "_consultar_cuenta", lambda uid: next(estados))
    seg._decodificar(_token(seg))
    seg.invalidar_cuenta(7)
    with pytest.raises(HTTPException):
        seg._decodificar(_token(seg))
