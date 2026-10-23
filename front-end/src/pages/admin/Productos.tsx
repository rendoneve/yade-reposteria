import { useState, type FormEvent } from 'react'
import botonEditar from '../../assets/img/boton-editar.png'
import postreEjemplo from '../../assets/img/postre-ejemplo.png'
import AdminLayout from '../../components/AdminLayout'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import Modal from '../../components/Modal'
import {
  api,
  ETIQUETA_DISPONIBILIDAD,
  formatoPrecio,
  type Categoria,
  type Disponibilidad,
  type Etiqueta,
  type Producto,
} from '../../lib/api'
import { Link, navegar, useRuta } from '../../lib/router'
import { useDatos } from '../../lib/useDatos'

/* ADMINISTRADOR productos (Figma 37:258): tarjetas de categorías. Al abrir una
   categoría se muestran sus productos con el mismo diseño de tarjeta. */
export default function Productos() {
  const { path } = useRuta()
  const id = Number(path.split('/')[3]) || null
  return id ? <ProductosDeCategoria categoriaId={id} /> : <Categorias />
}

/* ---------- Categorías ---------- */

function Categorias() {
  // En el orden en que se crearon
  const categorias = useDatos(() => api<Categoria[]>('/categorias').then((l) => [...l].sort((a, b) => a.id - b.id)))
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null)

  return (
    <AdminLayout
      titulo="Productos"
      acciones={<button type="button" className="boton-pildora" onClick={() => setEditando('nueva')}>Añadir Categoria</button>}
    >
      {categorias.cargando && <Cargando />}
      {categorias.error && <MensajeError texto={categorias.error} reintentar={categorias.recargar} />}
      {categorias.datos?.length === 0 && <Vacio texto="Aún no hay categorías. Crea la primera con “Añadir Categoria”." />}
      <div className="grid-tarjetas">
        {categorias.datos?.map((c) => (
          <TarjetaAdmin
            key={c.id}
            imagen={c.imagen_url}
            titulo={c.nombre}
            subtitulo={`${c.cantidad_productos} ${c.cantidad_productos === 1 ? 'elemento' : 'elementos'}`}
            onAbrir={() => navegar(`/admin/productos/${c.id}`)}
            onEditar={() => setEditando(c)}
          />
        ))}
      </div>
      {editando && (
        <FormCategoria
          categoria={editando === 'nueva' ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); categorias.recargar() }}
        />
      )}
    </AdminLayout>
  )
}

function FormCategoria({ categoria, onCerrar, onGuardado }: { categoria: Categoria | null; onCerrar: () => void; onGuardado: () => void }) {
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const guardar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = { nombre: String(f.get('nombre')).trim(), imagen_url: String(f.get('imagen_url')).trim() || null }
    await ejecutar(() =>
      categoria
        ? api(`/categorias/${categoria.id}`, { method: 'PATCH', body })
        : api('/categorias', { method: 'POST', body }),
    )
  }

  const eliminar = async () => {
    if (!categoria) return
    await ejecutar(() => api(`/categorias/${categoria.id}`, { method: 'DELETE' }))
  }

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setEnviando(true)
    setError(null)
    try {
      await accion()
      onGuardado()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={categoria ? 'Editar categoría' : 'Nueva categoría'} onCerrar={onCerrar}>
      <form className="form-admin" onSubmit={guardar}>
        <label>Nombre<input name="nombre" required maxLength={100} defaultValue={categoria?.nombre} /></label>
        <label>URL de la imagen<input name="imagen_url" type="url" maxLength={500} defaultValue={categoria?.imagen_url ?? ''} placeholder="https://…" /></label>
        {error && <p className="form-admin__error" role="alert">{error}</p>}
        <div className="form-admin__acciones">
          {categoria && <button type="button" className="boton-peligro" onClick={eliminar} disabled={enviando}>Eliminar</button>}
          <button type="submit" className="boton-pildora" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Productos de una categoría ---------- */

function ProductosDeCategoria({ categoriaId }: { categoriaId: number }) {
  const categoria = useDatos(() => api<Categoria>(`/categorias/${categoriaId}`), [categoriaId])
  const productos = useDatos(
    () => api<Producto[]>('/productos', { params: { categoria_id: categoriaId, limit: 500 } }),
    [categoriaId],
  )
  const [editando, setEditando] = useState<Producto | 'nuevo' | null>(null)

  return (
    <AdminLayout
      titulo={categoria.datos?.nombre ?? 'Productos'}
      acciones={<button type="button" className="boton-pildora" onClick={() => setEditando('nuevo')}>Añadir Producto</button>}
    >
      <Link to="/admin/productos" className="enlace-dorado enlace-dorado--volver">← Todas las categorías</Link>
      {(productos.cargando || categoria.cargando) && <Cargando />}
      {categoria.error && <MensajeError texto={categoria.error} />}
      {productos.error && <MensajeError texto={productos.error} reintentar={productos.recargar} />}
      {productos.datos?.length === 0 && <Vacio texto="Esta categoría no tiene productos todavía." />}
      <div className="grid-tarjetas">
        {productos.datos?.map((p) => (
          <TarjetaAdmin
            key={p.id}
            imagen={p.imagen_url || postreEjemplo}
            titulo={p.nombre}
            subtitulo={`${formatoPrecio(p.precio)} · ${ETIQUETA_DISPONIBILIDAD[p.disponibilidad]}`}
            onEditar={() => setEditando(p)}
          />
        ))}
      </div>
      {editando && (
        <FormProducto
          producto={editando === 'nuevo' ? null : editando}
          categoriaId={categoriaId}
          onCerrar={() => setEditando(null)}
          onGuardado={() => { setEditando(null); productos.recargar() }}
        />
      )}
    </AdminLayout>
  )
}

function FormProducto({ producto, categoriaId, onCerrar, onGuardado }: {
  producto: Producto | null
  categoriaId: number
  onCerrar: () => void
  onGuardado: () => void
}) {
  const categorias = useDatos(() => api<Categoria[]>('/categorias'))
  const etiquetas = useDatos(() => api<Etiqueta[]>('/etiquetas'))
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setEnviando(true)
    setError(null)
    try {
      await accion()
      onGuardado()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const body = {
      nombre: String(f.get('nombre')).trim(),
      descripcion: String(f.get('descripcion')).trim(),
      precio: String(f.get('precio')),
      imagen_url: String(f.get('imagen_url')).trim() || null,
      disponibilidad: f.get('disponibilidad') as Disponibilidad,
      categoria_id: Number(f.get('categoria_id')),
      etiquetas: f.getAll('etiquetas').map(String),
    }
    ejecutar(() =>
      producto
        ? api(`/productos/${producto.id}`, { method: 'PATCH', body })
        : api('/productos', { method: 'POST', body }),
    )
  }

  const eliminar = () => producto && ejecutar(() => api(`/productos/${producto.id}`, { method: 'DELETE' }))

  return (
    <Modal titulo={producto ? 'Editar producto' : 'Nuevo producto'} onCerrar={onCerrar}>
      <form className="form-admin" onSubmit={guardar}>
        <label>Nombre<input name="nombre" required maxLength={150} defaultValue={producto?.nombre} /></label>
        <label>Descripción<textarea name="descripcion" rows={3} defaultValue={producto?.descripcion} /></label>
        <div className="form-admin__fila">
          <label>Precio<input name="precio" type="number" min={0} step="0.01" required defaultValue={producto?.precio} /></label>
          <label>
            Disponibilidad
            <select name="disponibilidad" defaultValue={producto?.disponibilidad ?? 'stock'}>
              {(Object.keys(ETIQUETA_DISPONIBILIDAD) as Disponibilidad[]).map((d) => (
                <option key={d} value={d}>{ETIQUETA_DISPONIBILIDAD[d]}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Categoría
          <select name="categoria_id" defaultValue={producto?.categoria_id ?? categoriaId} key={categorias.datos?.length}>
            {categorias.datos?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </label>
        <label>URL de la imagen<input name="imagen_url" type="url" maxLength={500} defaultValue={producto?.imagen_url ?? ''} placeholder="https://…" /></label>
        <fieldset className="form-admin__etiquetas">
          <legend>Etiquetas</legend>
          {etiquetas.datos?.map((e) => (
            <label key={e.id} className="filtros__chip form-admin__chip">
              <input type="checkbox" name="etiquetas" value={e.nombre} defaultChecked={producto?.etiquetas.includes(e.nombre)} />
              {e.nombre}
            </label>
          ))}
        </fieldset>
        {error && <p className="form-admin__error" role="alert">{error}</p>}
        <div className="form-admin__acciones">
          {producto && <button type="button" className="boton-peligro" onClick={eliminar} disabled={enviando}>Eliminar</button>}
          <button type="submit" className="boton-pildora" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
        </div>
      </form>
    </Modal>
  )
}

/* ---------- Tarjeta (Figma 37:649) ---------- */

function TarjetaAdmin({ imagen, titulo, subtitulo, onAbrir, onEditar }: {
  imagen: string | null
  titulo: string
  subtitulo: string
  onAbrir?: () => void
  onEditar: () => void
}) {
  return (
    <article className={`tarjeta-cat${onAbrir ? ' tarjeta-cat--clic' : ''}`}>
      {onAbrir ? (
        <button type="button" className="tarjeta-cat__abrir" onClick={onAbrir} aria-label={`Abrir ${titulo}`}>
          <Foto src={imagen} />
        </button>
      ) : (
        <Foto src={imagen} />
      )}
      <div className="tarjeta-cat__pie">
        <div>
          <h2 className="tarjeta-cat__titulo">{titulo}</h2>
          <p className="tarjeta-cat__subtitulo">{subtitulo}</p>
        </div>
        <button type="button" className="tarjeta-cat__editar" onClick={onEditar} aria-label={`Editar ${titulo}`}>
          <img src={botonEditar} width={52} height={52} alt="" />
        </button>
      </div>
    </article>
  )
}

function Foto({ src }: { src: string | null }) {
  return src ? <img className="tarjeta-cat__foto" src={src} alt="" loading="lazy" /> : <div className="tarjeta-cat__foto tarjeta-cat__foto--vacia" />
}
