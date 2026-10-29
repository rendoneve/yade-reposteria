from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core import cache
from app.core.actividad import registrar_actividad
from app.core.database import get_db, leer
from app.core.security import Admin
from app.models import Etiqueta
from app.schemas import EtiquetaIn, EtiquetaOut

router = APIRouter(prefix="/etiquetas", tags=["Etiquetas"])
DB = Annotated[Session, Depends(get_db)]


@router.get("", response_model=list[EtiquetaOut])
def listar_etiquetas():
    return cache.obtener(
        "etiquetas", lambda: leer(lambda db: [EtiquetaOut.model_validate(e) for e in repo.listar_etiquetas(db)])
    )


@router.post("", response_model=EtiquetaOut, status_code=status.HTTP_201_CREATED)
def crear_etiqueta(datos: EtiquetaIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    nombre = datos.nombre.strip().lower()
    if repo.etiquetas_por_nombre(db, [nombre])[0]:
        raise HTTPException(status.HTTP_409_CONFLICT, "Esa etiqueta ya existe")
    e = Etiqueta(nombre=nombre)
    db.add(e)
    db.commit()
    cache.limpiar()
    tareas.add_task(registrar_actividad, admin.username, f"Nueva etiqueta: {e.nombre}", "nuevo")
    return e


@router.delete("/{etiqueta_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_etiqueta(etiqueta_id: int, admin: Admin, db: DB, tareas: BackgroundTasks):
    e = db.get(Etiqueta, etiqueta_id)
    if not e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Etiqueta no encontrada")
    nombre = e.nombre
    db.delete(e)  # se quita de los productos que la tenían (ON DELETE CASCADE)
    db.commit()
    cache.limpiar()
    tareas.add_task(registrar_actividad, admin.username, f"Eliminó la etiqueta {nombre}", "eliminacion")
