import time
from datetime import UTC, date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import InterfaceError, OperationalError
from sqlalchemy.orm import Session

from app import repository as repo
from app.core import agenda, negocio
from app.core.actividad import registrar_actividad
from app.core.catalogo import nombres_de_productos
from app.core.config import settings
from app.core.database import engine, get_db
from app.core.security import Admin, UsuarioActual, UsuarioOpcional, require_internal_key
from app.models import Cita, CitaProducto
from app.schemas import (
    CitaAdminIn,
    CitaIn,
    CitaInternaOut,
    CitaOut,
    ResumenAdminOut,
    CitaPublicaOut,
    CitaUpdate,
    ConteoOut,
    DisponibilidadOut,
    FranjaOut,
    Estado,
    EstadoIn,
)

router = APIRouter(prefix="/citas", tags=["Citas"])
DB = Annotated[Session, Depends(get_db)]

ESTADO_EN_FRASE = {"cancelado": "cancelada", "en proceso": "en proceso", "terminado": "terminada"}


def _obtener_o_404(db: Session, cita_id: int) -> Cita:
    cita = db.get(Cita, cita_id)
    if not cita:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada")
    return cita


def _validar_futura(fecha: datetime) -> None:
    if fecha <= datetime.now(UTC):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "La fecha de la cita ya pasó")


def _validar_agenda(db: Session, fecha: datetime) -> None:
    """La cita debe caer en el horario del negocio y no encimarse con otras.
    Se llama dentro de la transacción que guarda la cita, con el candado de la agenda tomado."""
    if fecha > datetime.now(UTC) + timedelta(days=settings.dias_maximos_agenda):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Solo se puede agendar con hasta {settings.dias_maximos_agenda} días de anticipación",
        )
    horarios = negocio.horarios()
    if horarios is not None and (motivo := agenda.fuera_de_horario(fecha, horarios)):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, motivo)
    repo.bloquear_agenda(db)
    ocupadas = repo.fechas_ocupadas(db, fecha, fecha + agenda.DURACION)
    if sum(agenda.se_enciman(fecha, o) for o in ocupadas) >= settings.citas_simultaneas:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Esa hora ya está ocupada. Elige otra hora disponible."
        )


def _productos(ids: list[int]) -> list[CitaProducto]:
    """Valida los productos en servicio-catalogo y guarda su nombre (sin repetir ids)."""
    ids = list(dict.fromkeys(ids))
    if not ids:
        return []
    nombres = nombres_de_productos(ids)
    return [CitaProducto(producto_id=i, nombre=nombres[i]) for i in ids]


# ---------- Público (formulario del sitio) ----------
@router.post("", response_model=CitaPublicaOut, status_code=status.HTTP_201_CREATED)
def agendar_cita(datos: CitaIn, db: DB, tareas: BackgroundTasks, usuario: UsuarioOpcional):
    """El cliente agenda una cita desde el sitio. Siempre queda en estado 'proximo'.
    Si tiene sesión iniciada, la cita queda en su cuenta."""
    _validar_futura(datos.fecha)
    productos = _productos(datos.producto_ids)  # antes del candado: es una llamada HTTP
    _validar_agenda(db, datos.fecha)
    cita = Cita(
        **datos.model_dump(exclude={"producto_ids"}),
        estado="proximo",
        usuario_id=usuario.id if usuario else None,
        productos=productos,
    )
    db.add(cita)
    db.commit()
    tareas.add_task(
        registrar_actividad, "Sitio web", f"Nueva cita de {cita.nombre_cliente}", "nuevo"
    )
    return cita


@router.get("/disponibilidad", response_model=DisponibilidadOut)
def disponibilidad(db: DB, fecha: date = Query(description="Día a consultar (hora local del negocio)")):
    """Horas en que se puede agendar ese día, según el horario del negocio y las citas ya apartadas."""
    base = DisponibilidadOut(
        fecha=fecha, configurado=False, abierto=True, duracion_minutos=settings.duracion_cita_minutos
    )
    horarios = negocio.horarios()
    if horarios is None:
        return base
    base.configurado = True
    horario = horarios.get(agenda.dia_semana(fecha))
    if horario is None:
        base.abierto = False
        return base
    base.abre, base.cierra = horario
    inicios = agenda.franjas(fecha, horario)
    if not inicios:
        return base
    ocupadas = repo.fechas_ocupadas(db, inicios[0], inicios[-1] + agenda.DURACION)
    ahora = datetime.now(UTC)
    base.franjas = [
        FranjaOut(
            inicio=inicio,
            disponible=inicio > ahora
            and sum(agenda.se_enciman(inicio, o) for o in ocupadas) < settings.citas_simultaneas,
        )
        for inicio in inicios
    ]
    return base


# ---------- Cliente con cuenta (van antes de /{cita_id}) ----------
@router.get("/mias", response_model=list[CitaOut])
def mis_citas(usuario: UsuarioActual, db: DB):
    return repo.listar_de_usuario(db, usuario.id)


@router.patch("/mias/{cita_id}/cancelar", response_model=CitaOut)
def cancelar_mi_cita(cita_id: int, usuario: UsuarioActual, db: DB, tareas: BackgroundTasks):
    cita = db.get(Cita, cita_id)
    if not cita or cita.usuario_id != usuario.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Cita no encontrada")
    if cita.estado != "proximo":
        raise HTTPException(status.HTTP_409_CONFLICT, f"La cita ya está {ESTADO_EN_FRASE[cita.estado]}: no se puede cancelar")
    if cita.fecha <= datetime.now(UTC):
        raise HTTPException(status.HTTP_409_CONFLICT, "La fecha de la cita ya pasó: no se puede cancelar")
    cita.estado = "cancelado"
    db.commit()
    tareas.add_task(
        registrar_actividad, usuario.username, f"{cita.nombre_cliente} canceló su cita", "modificacion"
    )
    return cita


# ---------- Entre servicios ----------
@router.get(
    "/interno/{cita_id}",
    response_model=CitaInternaOut,
    dependencies=[Depends(require_internal_key)],
    include_in_schema=False,
)
def cita_interna(cita_id: int, db: DB):
    """servicio-catalogo la consulta para validar que una reseña corresponde a una cita terminada."""
    return _obtener_o_404(db, cita_id)


# ---------- Administración ----------
@router.get("", response_model=list[CitaOut])
def listar_citas(
    admin: Admin,
    db: DB,
    response: Response,
    estado: Estado | None = None,
    tipo_servicio: str | None = None,
    desde: date | None = Query(default=None, description="Día inicial (incluido)"),
    hasta: date | None = Query(default=None, description="Día final (incluido)"),
    q: str | None = Query(default=None, description="Busca por nombre, teléfono o correo"),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    citas, total = repo.listar(db, estado, tipo_servicio, desde, hasta, q, limit, offset)
    response.headers["X-Total-Count"] = str(total)  # para paginar en el panel
    return citas


# Contratos que usa servicio-actividad para el panel. Van antes de /{cita_id}.
@router.get("/proximas/count", response_model=ConteoOut)
def contar_proximas(admin: Admin, db: DB):
    return ConteoOut(total=repo.contar_proximas(db))


@router.get("/terminadas/count", response_model=ConteoOut)
def contar_terminadas(admin: Admin, db: DB):
    return ConteoOut(total=repo.contar_terminadas(db))


@router.get("/resumen", response_model=ResumenAdminOut)
def resumen_admin(admin: Admin, db: DB):
    for intento in range(2):
        try:
            return repo.resumen_admin(db)
        except (InterfaceError, OperationalError):
            db.rollback()
            engine.dispose()
            if intento:
                raise HTTPException(
                    status.HTTP_503_SERVICE_UNAVAILABLE,
                    "La base de datos se está reconectando. Vuelve a intentar.",
                )
            time.sleep(0.2)


@router.post("/admin", response_model=CitaOut, status_code=status.HTTP_201_CREATED)
def capturar_cita(datos: CitaAdminIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    """Cita registrada por el administrador (por teléfono, en sucursal, etc.)."""
    cita = Cita(**datos.model_dump(exclude={"producto_ids"}), productos=_productos(datos.producto_ids))
    db.add(cita)
    db.commit()
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
    cambios = datos.model_dump(exclude_unset=True)
    if (ids := cambios.pop("producto_ids", None)) is not None:
        cita.productos = _productos(ids)
    for campo, valor in cambios.items():
        setattr(cita, campo, valor)
    db.commit()
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
