from datetime import date, datetime, time, timedelta

from sqlalchemy import case, func, or_, select, text
from sqlalchemy.orm import Session, lazyload

from app.core.agenda import DURACION, ZONA
from app.models import Cita

# Las citas que ocupan su horario (las canceladas y terminadas lo liberan)
ACTIVAS = ("proximo", "en proceso")


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
) -> tuple[list[Cita], int]:
    """Devuelve (página de citas, total con esos filtros).

    Orden: primero las que vienen (la más cercana arriba) y después las pasadas (la más reciente arriba)."""
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
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    pasada = Cita.fecha < func.now()
    stmt = stmt.order_by(
        pasada, case((pasada, None), else_=Cita.fecha).asc(), Cita.fecha.desc(), Cita.id
    ).limit(limit).offset(offset)
    return list(db.scalars(stmt)), total


def contar_proximas(db: Session) -> int:
    """Citas con estado 'proximo' cuya fecha todavía no pasa."""
    stmt = select(func.count(Cita.id)).where(Cita.estado == "proximo", Cita.fecha >= func.now())
    return db.scalar(stmt) or 0


def contar_terminadas(db: Session) -> int:
    stmt = select(func.count(Cita.id)).where(Cita.estado == "terminado")
    return db.scalar(stmt) or 0


def resumen_admin(db: Session) -> dict:
    """Datos del panel: los dos conteos en una sola consulta (FILTER) y las siguientes 3 citas."""
    proximas, terminadas = db.execute(
        select(
            func.count().filter(Cita.estado == "proximo", Cita.fecha >= func.now()),
            func.count().filter(Cita.estado == "terminado"),
        )
    ).one()
    siguientes = list(db.scalars(
        select(Cita)
        .options(lazyload(Cita.productos))
        .where(Cita.estado == "proximo", Cita.fecha >= func.now())
        .order_by(Cita.fecha, Cita.id)
        .limit(3)
    ))
    return {"citas_proximas": proximas, "citas_terminadas": terminadas, "siguientes": siguientes}


def listar_de_usuario(db: Session, usuario_id: int) -> list[Cita]:
    """Citas de un cliente, las más recientes primero."""
    stmt = select(Cita).where(Cita.usuario_id == usuario_id).order_by(Cita.fecha.desc(), Cita.id.desc())
    return list(db.scalars(stmt))


def fechas_ocupadas(
    db: Session, desde: datetime, hasta: datetime, excepto_id: int | None = None
) -> list[datetime]:
    """Inicio de las citas activas que pueden encimarse con el rango [desde, hasta)."""
    stmt = select(Cita.fecha).where(
        Cita.estado.in_(ACTIVAS), Cita.fecha > desde - DURACION, Cita.fecha < hasta
    )
    if excepto_id is not None:
        stmt = stmt.where(Cita.id != excepto_id)
    return list(db.scalars(stmt))


def bloquear_agenda(db: Session) -> None:
    """Candado de la transacción: dos personas no pueden apartar la misma hora al mismo tiempo.
    Se libera solo con el commit/rollback."""
    db.execute(text("SELECT pg_advisory_xact_lock(hashtext('citas.agenda'))"))
