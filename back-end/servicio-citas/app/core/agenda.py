"""Reglas de la agenda: horario de atención y horas disponibles (sin acceso a la BD)."""

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.config import settings

ZONA = ZoneInfo(settings.zona_horaria)
DURACION = timedelta(minutes=settings.duracion_cita_minutos)

Horarios = dict[int, tuple[time, time] | None]


def dia_semana(d: date) -> int:
    """0 = domingo ... 6 = sábado (como en negocio.horarios)."""
    return d.isoweekday() % 7


def fuera_de_horario(fecha: datetime, horarios: Horarios) -> str | None:
    """Motivo por el que la fecha no se puede agendar, o None si está dentro del horario."""
    local = fecha.astimezone(ZONA)
    horario = horarios.get(dia_semana(local.date()))
    if horario is None:
        return "Ese día no abrimos. Elige otro día."
    abre, cierra = horario
    inicio = local.replace(tzinfo=None)
    apertura = datetime.combine(local.date(), abre)
    cierre = datetime.combine(local.date(), cierra)
    if inicio < apertura or inicio + DURACION > cierre:
        ultima = (cierre - DURACION).time()
        return f"Ese día atendemos de {abre:%H:%M} a {cierra:%H:%M} (última cita a las {ultima:%H:%M})."
    return None


def franjas(d: date, horario: tuple[time, time]) -> list[datetime]:
    """Horas de inicio posibles de un día, cada DURACION, en hora local con zona."""
    abre, cierra = horario
    actual = datetime.combine(d, abre, tzinfo=ZONA)
    cierre = datetime.combine(d, cierra, tzinfo=ZONA)
    resultado = []
    while actual + DURACION <= cierre:
        resultado.append(actual)
        actual += DURACION
    return resultado


def se_enciman(a: datetime, b: datetime) -> bool:
    """Dos citas de la misma duración se enciman si empiezan a menos de DURACION una de otra."""
    return abs(a - b) < DURACION
