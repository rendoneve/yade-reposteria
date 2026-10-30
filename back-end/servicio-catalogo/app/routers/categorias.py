from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import repository as repo
from app.core import almacenamiento, cache
from app.core.actividad import registrar_actividad
from app.core.database import get_db, leer
from app.core.security import Admin
from app.models import Categoria
from app.schemas import CategoriaIn, CategoriaOut, CategoriaUpdate

router = APIRouter(prefix="/categorias", tags=["Categorías"])
DB = Annotated[Session, Depends(get_db)]


def _out(c: Categoria, cantidad: int) -> CategoriaOut:
    return CategoriaOut(id=c.id, nombre=c.nombre, imagen_url=c.imagen_url, cantidad_productos=cantidad)


def _obtener_o_404(db: Session, categoria_id: int) -> Categoria:
    categoria = db.get(Categoria, categoria_id)
    if not categoria:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Categoría no encontrada")
    return categoria


def _nombre_libre(db: Session, nombre: str, excepto_id: int | None = None) -> None:
    otra = repo.categoria_por_nombre(db, nombre)
    if otra and otra.id != excepto_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Ya existe una categoría con ese nombre")


@router.get("", response_model=list[CategoriaOut])
def listar_categorias():
    # Se pide en casi todas las páginas: sale de la caché y solo toca la BD cuando cambia algo
    return cache.obtener("categorias", lambda: leer(lambda db: [_out(c, n) for c, n in repo.listar_categorias(db)]))


@router.get("/{categoria_id}", response_model=CategoriaOut)
def obtener_categoria(categoria_id: int, db: DB):
    c = _obtener_o_404(db, categoria_id)
    return _out(c, repo.contar_productos_de(db, c.id))


@router.post("", response_model=CategoriaOut, status_code=status.HTTP_201_CREATED)
def crear_categoria(datos: CategoriaIn, admin: Admin, db: DB, tareas: BackgroundTasks):
    _nombre_libre(db, datos.nombre)
    c = Categoria(**datos.model_dump())
    db.add(c)
    db.commit()
    cache.limpiar()
    tareas.add_task(registrar_actividad, admin.username, f"Nueva categoría: {c.nombre}", "nuevo")
    return _out(c, 0)


@router.patch("/{categoria_id}", response_model=CategoriaOut)
def editar_categoria(
    categoria_id: int, datos: CategoriaUpdate, admin: Admin, db: DB, tareas: BackgroundTasks
):
    c = _obtener_o_404(db, categoria_id)
    cambios = datos.model_dump(exclude_unset=True)
    imagen_anterior = c.imagen_url
    if cambios.get("nombre"):
        _nombre_libre(db, cambios["nombre"], excepto_id=c.id)
    for campo, valor in cambios.items():
        setattr(c, campo, valor)
    db.commit()
    cache.limpiar()
    if imagen_anterior != c.imagen_url and not repo.imagen_en_uso(db, imagen_anterior):
        tareas.add_task(almacenamiento.borrar, imagen_anterior)
    tareas.add_task(
        registrar_actividad, admin.username, f"Modificó la categoría {c.nombre}", "modificacion"
    )
    return _out(c, repo.contar_productos_de(db, c.id))


@router.delete("/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_categoria(categoria_id: int, admin: Admin, db: DB, tareas: BackgroundTasks):
    c = _obtener_o_404(db, categoria_id)
    if (n := repo.contar_productos_de(db, c.id)) > 0:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"No se puede eliminar: la categoría tiene {n} producto(s). Muévelos o elimínalos primero.",
        )
    nombre = c.nombre
    imagen = c.imagen_url
    db.delete(c)
    db.commit()
    cache.limpiar()
    if not repo.imagen_en_uso(db, imagen):
        tareas.add_task(almacenamiento.borrar, imagen)
    tareas.add_task(registrar_actividad, admin.username, f"Eliminó la categoría {nombre}", "eliminacion")
