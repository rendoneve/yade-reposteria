"""Moderación y calificación de reseñas (esquemas de servicio-catalogo)."""

import importlib.util
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError

RAIZ = Path(__file__).resolve().parents[1] / "servicio-catalogo"


@pytest.fixture()
def esq():
    for m in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[m]
    sys.path.insert(0, str(RAIZ))
    try:
        spec = importlib.util.spec_from_file_location("esquemas_catalogo", RAIZ / "app/schemas.py")
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
        return modulo
    finally:
        sys.path.remove(str(RAIZ))


def test_resena_de_cliente_exige_calificacion(esq):
    with pytest.raises(ValidationError):
        esq.MiResenaIn(cita_id=1, descripcion="Muy rico")
    assert esq.MiResenaIn(cita_id=1, descripcion="Muy rico", calificacion=5).calificacion == 5


@pytest.mark.parametrize("valor", [0, 6, -1])
def test_calificacion_fuera_de_rango(esq, valor):
    with pytest.raises(ValidationError):
        esq.MiResenaIn(cita_id=1, descripcion="x", calificacion=valor)
    with pytest.raises(ValidationError):
        esq.ResenaIn(nombre_cliente="Ana", descripcion="x", producto_ids=[1], calificacion=valor)


def test_resena_del_admin_sale_publicada_por_defecto(esq):
    r = esq.ResenaIn(nombre_cliente="Ana", descripcion="Rico", producto_ids=[1])
    assert r.aprobada is True and r.calificacion is None


def test_descripcion_tiene_tope(esq):
    with pytest.raises(ValidationError):
        esq.ResenaIn(nombre_cliente="Ana", descripcion="x" * 2001, producto_ids=[1])


def test_moderar_solo_con_aprobada(esq):
    cambios = esq.ResenaUpdate(aprobada=False).model_dump(exclude_unset=True, exclude_none=True)
    assert cambios == {"aprobada": False}
