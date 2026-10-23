from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core.actividad import registrar_actividad
from app.core.database import get_db
from app.core.passwords import HASH_FALSO, hash_password, verificar_password
from app.core.security import Admin
from app.core.tokens import crear_token
from app.models import Usuario
from app.routers.usuarios import validar_unicos
from app.schemas import CambioPassword, LoginIn, PerfilUpdate, TokenOut, UsuarioOut

router = APIRouter(prefix="/auth", tags=["Autenticación"])
DB = Annotated[Session, Depends(get_db)]


def _usuario_activo(db: Session, admin: Admin) -> Usuario:
    usuario = repo.obtener(db, admin.id)
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


@router.get("/me", response_model=UsuarioOut)
def mi_perfil(admin: Admin, db: DB):
    return _usuario_activo(db, admin)


@router.patch("/me", response_model=UsuarioOut)
def editar_mi_perfil(datos: PerfilUpdate, admin: Admin, db: DB, tareas: BackgroundTasks):
    usuario = _usuario_activo(db, admin)
    cambios = datos.model_dump(exclude_unset=True)
    validar_unicos(db, correo=cambios.get("correo"), excepto_id=usuario.id)
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    db.commit()
    db.refresh(usuario)
    tareas.add_task(registrar_actividad, admin.username, "Actualizó su perfil", "modificacion")
    return usuario


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def cambiar_mi_password(datos: CambioPassword, admin: Admin, db: DB, tareas: BackgroundTasks):
    usuario = _usuario_activo(db, admin)
    if not verificar_password(datos.actual, usuario.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "La contraseña actual no es correcta")
    usuario.password_hash = hash_password(datos.nueva)
    db.commit()
    tareas.add_task(registrar_actividad, admin.username, "Cambió su contraseña", "modificacion")
