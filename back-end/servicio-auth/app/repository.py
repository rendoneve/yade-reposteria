from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models import Usuario


def listar(db: Session) -> list[Usuario]:
    return list(db.scalars(select(Usuario).order_by(Usuario.nombre_completo)))


def obtener(db: Session, usuario_id: int) -> Usuario | None:
    return db.get(Usuario, usuario_id)


def por_login(db: Session, texto: str) -> Usuario | None:
    """Busca por nombre de usuario o por correo, sin importar mayúsculas."""
    t = texto.strip().lower()
    stmt = select(Usuario).where(
        or_(func.lower(Usuario.username) == t, func.lower(Usuario.correo) == t)
    )
    return db.scalars(stmt).first()


def existe_username(db: Session, username: str, excepto_id: int | None = None) -> bool:
    stmt = select(Usuario.id).where(func.lower(Usuario.username) == username.lower())
    if excepto_id:
        stmt = stmt.where(Usuario.id != excepto_id)
    return db.scalar(stmt) is not None


def existe_correo(db: Session, correo: str, excepto_id: int | None = None) -> bool:
    stmt = select(Usuario.id).where(func.lower(Usuario.correo) == correo.lower())
    if excepto_id:
        stmt = stmt.where(Usuario.id != excepto_id)
    return db.scalar(stmt) is not None


def contar(db: Session) -> int:
    return db.scalar(select(func.count(Usuario.id))) or 0
