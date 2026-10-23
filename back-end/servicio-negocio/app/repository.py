from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Horario, Negocio


def obtener_negocio(db: Session) -> Negocio:
    """Devuelve la fila única; la crea vacía si alguien la borró."""
    negocio = db.get(Negocio, 1)
    if negocio is None:
        negocio = Negocio(id=1)
        db.add(negocio)
        db.commit()
        db.refresh(negocio)
    return negocio


def listar_horarios(db: Session) -> list[Horario]:
    return list(db.scalars(select(Horario).order_by(Horario.dia_semana)))
