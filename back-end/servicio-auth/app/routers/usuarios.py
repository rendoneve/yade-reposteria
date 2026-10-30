from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.actividad import registrar_actividad
from app.core.database import get_db
from app.core.passwords import hash_password
from app.core.security import Admin, invalidar_cuenta
from app.models import Usuario
from app.schemas import UsuarioIn, UsuarioOut, UsuarioUpdate

router = APIRouter(prefix="/usuarios", tags=["Usuarios"])
DB = Annotated[Session, Depends(get_db)]


def validar_unicos(
    db: Session, username: str | None = None, correo: str | None = None, excepto_id: int | None = None
) -> None:
    if username and repo.existe_username(db, username, excepto_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese nombre de usuario ya está en uso")
    if correo and repo.existe_correo(db, correo, excepto_id):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese correo ya está registrado")


def _obtener_o_404(db: Session, usuario_id: int) -> Usuario:
    usuario = repo.obtener(db, usuario_id)
    if not usuario:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    return usuario


@router.get("", response_model=list[UsuarioOut])
def listar_usuarios(admin: Admin, db: DB):
    return repo.listar(db)


@router.get("/{usuario_id}", response_model=UsuarioOut)
def obtener_usuario(usuario_id: int, admin: Admin, db: DB):
    return _obtener_o_404(db, usuario_id)


@router.post("", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear_usuario(datos: UsuarioIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    validar_unicos(db, datos.username, datos.correo)
    usuario = Usuario(
        nombre_completo=datos.nombre_completo,
        username=datos.username,
        correo=datos.correo,
        telefono=datos.telefono,
        password_hash=hash_password(datos.password),
        rol="admin",  # el panel solo da de alta administradores; los clientes se registran solos
    )
    db.add(usuario)
    db.commit()
    tareas.add_task(
        registrar_actividad, admin.username, f"Nuevo usuario: {usuario.username}", "nuevo"
    )
    return usuario


@router.patch("/{usuario_id}", response_model=UsuarioOut)
def editar_usuario(
    usuario_id: int, datos: UsuarioUpdate, admin: Admin, db: DB, tareas: BackgroundTasks
):
    usuario = _obtener_o_404(db, usuario_id)
    cambios = datos.model_dump(exclude_unset=True)
    if usuario.id == admin.id and cambios.get("activo") is False:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes desactivar tu propia cuenta")
    validar_unicos(db, cambios.get("username"), cambios.get("correo"), excepto_id=usuario.id)
    if (password := cambios.pop("password", None)) is not None:
        usuario.password_hash = hash_password(password)
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    db.commit()
    invalidar_cuenta(usuario.id)
    tareas.add_task(
        registrar_actividad, admin.username, f"Modificó el usuario {usuario.username}", "modificacion"
    )
    return usuario


@router.delete("/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario(usuario_id: int, admin: Admin, db: DB, tareas: BackgroundTasks):
    usuario = _obtener_o_404(db, usuario_id)
    if usuario.id == admin.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No puedes eliminar tu propia cuenta")
    nombre = usuario.username
    db.delete(usuario)
    db.commit()
    invalidar_cuenta(usuario_id)
    tareas.add_task(registrar_actividad, admin.username, f"Eliminó el usuario {nombre}", "eliminacion")
