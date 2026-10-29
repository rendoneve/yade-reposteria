from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Actividad


def crear(db: Session, persona: str, nombre: str, tipo: str) -> Actividad:
    a = Actividad(persona=persona, nombre=nombre[:255], tipo=tipo)
    db.add(a)
    db.commit()
    return a


def listar(
    db: Session, tipo: str | None = None, persona: str | None = None, limit: int = 50, offset: int = 0
) -> list[Actividad]:
    stmt = select(Actividad)
    if tipo:
        stmt = stmt.where(Actividad.tipo == tipo)
    if persona:
        stmt = stmt.where(Actividad.persona == persona)
    stmt = stmt.order_by(Actividad.fecha.desc(), Actividad.id.desc()).limit(limit).offset(offset)
    return list(db.scalars(stmt))
