from datetime import UTC, date, datetime
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.actividad import registrar_actividad
from app.core.database import get_db
from app.core.security import Admin
from app.models import Cita
from app.schemas import (
    CitaAdminIn,
    CitaIn,
    CitaOut,
    CitaPublicaOut,
    CitaUpdate,
    ConteoOut,
    Estado,
    EstadoIn,
)

router = APIRouter(prefix="/citas", tags=["Citas"])
DB = Annotated[Session, Depends(get_db)]


def _obtener_o_404(db: Session, cita_id: int) -> Cita:
    cita = db.get(Cita, cita_id)
    if not cita:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada")
    return cita


def _validar_futura(fecha: datetime) -> None:
    if fecha <= datetime.now(UTC):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La fecha de la cita ya pasó")


# ---------- Público (formulario del sitio) ----------
@router.post("", response_model=CitaPublicaOut, status_code=status.HTTP_201_CREATED)
def agendar_cita(datos: CitaIn, db: DB, tareas: BackgroundTasks):
    """El cliente agenda una cita desde el sitio. Siempre queda en estado 'proximo'."""
    _validar_futura(datos.fecha)
    cita = Cita(**datos.model_dump(), estado="proximo")
    db.add(cita)
    db.commit()
    db.refresh(cita)
    tareas.add_task(
        registrar_actividad, "Sitio web", f"Nueva cita de {cita.nombre_cliente}", "nuevo"
    )
    return cita


# ---------- Administración ----------
@router.get("", response_model=list[CitaOut])
def listar_citas(
    admin: Admin,
    db: DB,
    estado: Estado | None = None,
    tipo_servicio: str | None = None,
    desde: date | None = Query(default=None, description="Día inicial (incluido)"),
    hasta: date | None = Query(default=None, description="Día final (incluido)"),
    q: str | None = Query(default=None, description="Busca por nombre, teléfono o correo"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    return repo.listar(db, estado, tipo_servicio, desde, hasta, q, limit, offset)


# Contratos que usa servicio-actividad para el panel. Van antes de /{cita_id}.
@router.get("/proximas/count", response_model=ConteoOut)
def contar_proximas(admin: Admin, db: DB):
    return ConteoOut(total=repo.contar_proximas(db))


@router.get("/terminadas/count", response_model=ConteoOut)
def contar_terminadas(admin: Admin, db: DB):
    return ConteoOut(total=repo.contar_terminadas(db))


@router.post("/admin", response_model=CitaOut, status_code=status.HTTP_201_CREATED)
def capturar_cita(datos: CitaAdminIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    """Cita registrada por el administrador (por teléfono, en sucursal, etc.)."""
    cita = Cita(**datos.model_dump())
    db.add(cita)
    db.commit()
    db.refresh(cita)
    tareas.add_task(
        registrar_actividad, admin.username, f"Nueva cita de {cita.nombre_cliente}", "nuevo"
    )
    return cita


@router.get("/{cita_id}", response_model=CitaOut)
def obtener_cita(cita_id: int, admin: Admin, db: DB):
    return _obtener_o_404(db, cita_id)


@router.patch("/{cita_id}", response_model=CitaOut)
def editar_cita(cita_id: int, datos: CitaUpdate, admin: Admin, db: DB, tareas: BackgroundTasks):
    cita = _obtener_o_404(db, cita_id)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(cita, campo, valor)
    db.commit()
    db.refresh(cita)
    tareas.add_task(
        registrar_actividad,
        admin.username,
        f"Modificó la cita de {cita.nombre_cliente}",
        "modificacion",
    )
    return cita


@router.patch("/{cita_id}/estado", response_model=CitaOut)
def cambiar_estado(cita_id: int, datos: EstadoIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    cita = _obtener_o_404(db, cita_id)
    anterior = cita.estado
    cita.estado = datos.estado
    db.commit()
    db.refresh(cita)
    tareas.add_task(
        registrar_actividad,
        admin.username,
        f"Cita de {cita.nombre_cliente}: {anterior} → {cita.estado}",
        "modificacion",
    )
    return cita


@router.delete("/{cita_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cita(cita_id: int, admin: Admin, db: DB, tareas: BackgroundTasks):
    cita = _obtener_o_404(db, cita_id)
    nombre = cita.nombre_cliente
    db.delete(cita)
    db.commit()
    tareas.add_task(registrar_actividad, admin.username, f"Eliminó la cita de {nombre}", "eliminacion")
