from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, lazyload

from app.models import Cita

# Hora local del negocio, para interpretar filtros por día (?desde=2026-11-01)
ZONA = ZoneInfo("America/Mazatlan")


def _inicio_dia(d: date) -> datetime:
    return datetime.combine(d, time.min, tzinfo=ZONA)


def listar(
    db: Session,
    estado: str | None = None,
    tipo_servicio: str | None = None,
    desde: date | None = None,
    hasta: date | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[Cita]:
    stmt = select(Cita)
    if estado:
        stmt = stmt.where(Cita.estado == estado)
    if tipo_servicio:
        stmt = stmt.where(Cita.tipo_servicio == tipo_servicio)
    if desde:
        stmt = stmt.where(Cita.fecha >= _inicio_dia(desde))
    if hasta:
        stmt = stmt.where(Cita.fecha < _inicio_dia(hasta + timedelta(days=1)))
    if q:
        patron = f"%{q.strip()}%"
        stmt = stmt.where(
            or_(Cita.nombre_cliente.ilike(patron), Cita.telefono.ilike(patron), Cita.correo.ilike(patron))
        )
    stmt = stmt.order_by(Cita.fecha, Cita.id).limit(limit).offset(offset)
    return list(db.scalars(stmt))


def contar_proximas(db: Session) -> int:
    """Citas con estado 'proximo' cuya fecha todavía no pasa."""
    stmt = select(func.count(Cita.id)).where(Cita.estado == "proximo", Cita.fecha >= func.now())
    return db.scalar(stmt) or 0


def contar_terminadas(db: Session) -> int:
    stmt = select(func.count(Cita.id)).where(Cita.estado == "terminado")
    return db.scalar(stmt) or 0


def resumen_admin(db: Session) -> dict:
    """Datos que el panel necesita; resuelve los dos conteos y las siguientes citas en una visita HTTP."""
    ahora = datetime.now(UTC)
    siguientes = list(db.scalars(
        select(Cita)
        .options(lazyload(Cita.productos))
        .where(Cita.estado == "proximo", Cita.fecha >= ahora)
        .order_by(Cita.fecha, Cita.id)
        .limit(3)
    ))
    return {
        "citas_proximas": contar_proximas(db),
        "citas_terminadas": contar_terminadas(db),
        "siguientes": siguientes,
    }


def listar_de_usuario(db: Session, usuario_id: int) -> list[Cita]:
    """Citas de un cliente, las más recientes primero."""
    stmt = select(Cita).where(Cita.usuario_id == usuario_id).order_by(Cita.fecha.desc(), Cita.id.desc())
    return list(db.scalars(stmt))
