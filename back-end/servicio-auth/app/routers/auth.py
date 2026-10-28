from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.actividad import registrar_actividad
from app.core.database import get_db
from app.core.passwords import HASH_FALSO, hash_password, verificar_password
from app.core.security import UsuarioActual, UsuarioToken
from app.core.tokens import crear_token
from app.models import Usuario
from app.routers.usuarios import validar_unicos
from app.schemas import CambioPassword, LoginIn, PerfilUpdate, RegistroIn, TokenOut, UsuarioOut

router = APIRouter(prefix="/auth", tags=["Autenticación"])
DB = Annotated[Session, Depends(get_db)]


def _usuario_activo(db: Session, actual: UsuarioToken) -> Usuario:
    usuario = repo.obtener(db, actual.id)
    if not usuario or not usuario.activo:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "El usuario ya no está activo")
    return usuario


@router.post("/login", response_model=TokenOut)
def login(datos: LoginIn, db: DB):
    usuario = repo.por_login(db, datos.usuario)
    valido = verificar_password(datos.password, usuario.password_hash if usuario else HASH_FALSO)
    if not usuario or not valido:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Usuario o contraseña incorrectos")
    if not usuario.activo:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "El usuario está desactivado")
    token, segundos = crear_token(usuario)
    return TokenOut(access_token=token, expires_in=segundos, usuario=usuario)


@router.post("/registro", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def registro(datos: RegistroIn, db: DB, tareas: BackgroundTasks):
    """Crea una cuenta de cliente desde el sitio y deja la sesión iniciada."""
    validar_unicos(db, datos.username, datos.correo)
    usuario = Usuario(
        nombre_completo=datos.nombre_completo,
        username=datos.username,
        correo=datos.correo,
        telefono=datos.telefono,
        password_hash=hash_password(datos.password),
        rol="cliente",
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    tareas.add_task(
        registrar_actividad, usuario.username, f"Nuevo cliente registrado: {usuario.nombre_completo}", "nuevo"
    )
    token, segundos = crear_token(usuario)
    return TokenOut(access_token=token, expires_in=segundos, usuario=usuario)


@router.get("/me", response_model=UsuarioOut)
def mi_perfil(actual: UsuarioActual, db: DB):
    return _usuario_activo(db, actual)


@router.patch("/me", response_model=UsuarioOut)
def editar_mi_perfil(datos: PerfilUpdate, actual: UsuarioActual, db: DB, tareas: BackgroundTasks):
    usuario = _usuario_activo(db, actual)
    cambios = datos.model_dump(exclude_unset=True)
    validar_unicos(db, correo=cambios.get("correo"), excepto_id=usuario.id)
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    db.commit()
    db.refresh(usuario)
    # El historial es del panel: los cambios de perfil de los clientes no se registran
    if actual.rol == "admin":
        tareas.add_task(registrar_actividad, actual.username, "Actualizó su perfil", "modificacion")
    return usuario


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_mi_password(datos: CambioPassword, actual: UsuarioActual, db: DB, tareas: BackgroundTasks):
    usuario = _usuario_activo(db, actual)
    if not verificar_password(datos.actual, usuario.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña actual no es correcta")
    usuario.password_hash = hash_password(datos.nueva)
    db.commit()
    if actual.rol == "admin":
        tareas.add_task(registrar_actividad, actual.username, "Cambió su contraseña", "modificacion")
