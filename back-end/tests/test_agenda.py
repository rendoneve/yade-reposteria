"""Reglas puras de la agenda de servicio-citas (sin base de datos)."""

import importlib.util
import sys
from datetime import date, datetime, time, timedelta
from pathlib import Path

RAIZ = Path(__file__).resolve().parents[1] / "servicio-citas"


def _cargar(nombre: str, ruta: str):
    """Carga un módulo de servicio-citas sin chocar con los `app` de los otros servicios."""
    for m in [m for m in sys.modules if m == "app" or m.startswith("app.")]:
        del sys.modules[m]
    sys.path.insert(0, str(RAIZ))
    try:
        spec = importlib.util.spec_from_file_location(nombre, RAIZ / ruta)
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
        return modulo
    finally:
        sys.path.remove(str(RAIZ))


agenda = _cargar("agenda_citas", "app/core/agenda.py")
ZONA = agenda.ZONA
HORARIOS = {d: (time(9, 0), time(18, 0)) for d in range(1, 6)}  # lunes a viernes
HORARIOS[0] = None
HORARIOS[6] = None
LUNES = date(2026, 11, 2)
DOMINGO = date(2026, 11, 1)


def _a(d: date, h: int, m: int = 0) -> datetime:
    return datetime.combine(d, time(h, m), tzinfo=ZONA)


def test_dia_semana_domingo_es_cero():
    assert agenda.dia_semana(DOMINGO) == 0
    assert agenda.dia_semana(LUNES) == 1


def test_dentro_de_horario():
    assert agenda.fuera_de_horario(_a(LUNES, 10), HORARIOS) is None


def test_dia_cerrado():
    assert "no abrimos" in agenda.fuera_de_horario(_a(DOMINGO, 10), HORARIOS)


def test_antes_de_abrir_y_despues_de_cerrar():
    assert agenda.fuera_de_horario(_a(LUNES, 8, 30), HORARIOS) is not None
    assert agenda.fuera_de_horario(_a(LUNES, 18), HORARIOS) is not None


def test_la_ultima_cita_debe_terminar_antes_de_cerrar():
    ultima = _a(LUNES, 18) - agenda.DURACION
    assert agenda.fuera_de_horario(ultima, HORARIOS) is None
    assert agenda.fuera_de_horario(ultima + timedelta(minutes=1), HORARIOS) is not None


def test_franjas_cubren_el_horario():
    franjas = agenda.franjas(LUNES, (time(9, 0), time(18, 0)))
    assert franjas[0] == _a(LUNES, 9)
    assert franjas[-1] + agenda.DURACION == _a(LUNES, 18)
    assert all(b - a == agenda.DURACION for a, b in zip(franjas, franjas[1:]))


def test_se_enciman():
    base = _a(LUNES, 10)
    assert agenda.se_enciman(base, base)
    assert agenda.se_enciman(base, base + agenda.DURACION - timedelta(minutes=1))
    assert not agenda.se_enciman(base, base + agenda.DURACION)
