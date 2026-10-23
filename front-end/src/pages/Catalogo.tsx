import { useMemo, useState } from 'react'
import heroCatalogo from '../assets/img/hero-catalogo.png'
import Encabezado from '../components/Encabezado'
import { Cargando, MensajeError, Vacio } from '../components/Estado'
import Pie from '../components/Pie'
import TarjetaPostre from '../components/TarjetaPostre'
import {
  api,
  ETIQUETA_DISPONIBILIDAD,
  formatoPrecio,
  type Categoria,
  type Disponibilidad,
  type Etiqueta,
  type Producto,
} from '../lib/api'
import { navegar, useRuta } from '../lib/router'
import { useDatos } from '../lib/useDatos'

const DISPONIBILIDADES: Disponibilidad[] = ['bajo pedido', 'stock', 'proximamente']
const porId = <T extends { id: number }>(lista: T[]) => [...lista].sort((a, b) => a.id - b.id)
const capitalizar = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/* PRODUCTOS (Figma 20:2) */
export default function Catalogo() {
  const { query } = useRuta()
  // En el orden en que se crearon (así las acomoda el administrador)
  const categorias = useDatos(() => api<Categoria[]>('/categorias').then(porId))
  const etiquetas = useDatos(() => api<Etiqueta[]>('/etiquetas').then(porId))

  const idEnUrl = Number(query.get('categoria')) || null
  const seleccionada =
    categorias.datos?.find((c) => c.id === idEnUrl) ?? categorias.datos?.[0] ?? null

  const productos = useDatos(
    () =>
      seleccionada
        ? api<Producto[]>('/productos', { params: { categoria_id: seleccionada.id, limit: 500 } })
        : Promise.resolve([] as Producto[]),
    [seleccionada?.id],
  )

  const precioMaximo = useMemo(() => {
    const max = Math.max(0, ...(productos.datos ?? []).map((p) => Number(p.precio)))
    return Math.max(100, Math.ceil(max / 100) * 100)
  }, [productos.datos])

  const [rango, setRango] = useState<[number, number] | null>(null)
  const [disp, setDisp] = useState<Disponibilidad[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [min, max] = rango ?? [0, precioMaximo]

  const filtrados = (productos.datos ?? []).filter((p) => {
    const precio = Number(p.precio)
    if (precio < min || precio > max) return false
    if (disp.length && !disp.includes(p.disponibilidad)) return false
    if (tags.length && !p.etiquetas.some((e) => tags.includes(e))) return false
    return true
  })

  const alternar = <T,>(lista: T[], valor: T) =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]

  const elegirCategoria = (c: Categoria) => {
    setRango(null)
    navegar(`/catalogo?categoria=${c.id}`, true)
  }

  return (
    <div className="pagina">
      <section className="hero hero--catalogo">
        <Encabezado />
        <p className="hero__antetitulo">Nuestro Catalogo</p>
        <h1 className="hero__titulo hero__titulo--catalogo">
          <span className="hero__linea hero__linea--chica">POSTRES QUE HACEN</span>
          <span className="hero__linea">LA VIDA MAS DULCE</span>
        </h1>
        <img className="hero__imagen hero__imagen--catalogo" src={heroCatalogo} width={873} height={675} alt="" />
      </section>

      <div className="catalogo">
        <aside className="filtros" aria-label="Filtros">
          <h2 className="filtros__titulo-categorias">Categorias</h2>
          {categorias.error && <MensajeError texto={categorias.error} reintentar={categorias.recargar} />}
          <ul className="filtros__categorias">
            {categorias.datos?.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="filtros__categoria"
                  aria-pressed={c.id === seleccionada?.id}
                  onClick={() => elegirCategoria(c)}
                >
                  {c.nombre}
                </button>
              </li>
            ))}
          </ul>

          <hr className="filtros__linea" />
          <h3 className="filtros__subtitulo">Precio</h3>
          <div className="rango">
            <div className="rango__pista">
              <div
                className="rango__relleno"
                style={{ left: `${(min / precioMaximo) * 100}%`, right: `${100 - (max / precioMaximo) * 100}%` }}
              />
            </div>
            <input
              type="range" min={0} max={precioMaximo} step={10} value={min}
              aria-label="Precio mínimo"
              onChange={(e) => setRango([Math.min(Number(e.target.value), max), max])}
            />
            <input
              type="range" min={0} max={precioMaximo} step={10} value={max}
              aria-label="Precio máximo"
              onChange={(e) => setRango([min, Math.max(Number(e.target.value), min)])}
            />
          </div>
          <div className="rango__valores">
            <span>{formatoPrecio(min).replace('.00', '')}</span>
            <span>{formatoPrecio(max).replace('.00', '')}</span>
          </div>

          <hr className="filtros__linea" />
          <h3 className="filtros__subtitulo">Disponibilidad</h3>
          <div className="filtros__checks">
            {DISPONIBILIDADES.map((d) => (
              <label key={d} className="filtros__check">
                <input type="checkbox" checked={disp.includes(d)} onChange={() => setDisp(alternar(disp, d))} />
                {ETIQUETA_DISPONIBILIDAD[d]}
              </label>
            ))}
          </div>

          <hr className="filtros__linea" />
          <h3 className="filtros__subtitulo">Etiquetas</h3>
          <div className="filtros__chips">
            {etiquetas.datos?.map((e) => (
              <button
                key={e.id}
                type="button"
                className="filtros__chip"
                aria-pressed={tags.includes(e.nombre)}
                onClick={() => setTags(alternar(tags, e.nombre))}
              >
                {capitalizar(e.nombre)}
              </button>
            ))}
          </div>
          <hr className="filtros__linea" />
        </aside>

        <main className="catalogo__contenido">
          <h2 className="catalogo__titulo">{seleccionada?.nombre ?? 'Catálogo'}</h2>
          {(categorias.cargando || productos.cargando) && <Cargando />}
          {productos.error && <MensajeError texto={productos.error} reintentar={productos.recargar} />}
          {categorias.datos?.length === 0 && <Vacio texto="Todavía no hay categorías." />}
          {!productos.cargando && productos.datos && filtrados.length === 0 && seleccionada && (
            <Vacio texto="No hay postres con esos filtros." />
          )}
          <div className="catalogo__grid">
            {filtrados.map((p) => <TarjetaPostre key={p.id} producto={p} />)}
          </div>
        </main>
      </div>
      <Pie />
    </div>
  )
}
