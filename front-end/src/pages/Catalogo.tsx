import { SlidersHorizontal } from 'lucide-react'
import { useMemo, useState } from 'react'
import DetalleProducto from '../components/DetalleProducto'
import Encabezado from '../components/Encabezado'
import { EsqueletoPostres, MensajeError, Vacio } from '../components/Estado'
import Pie from '../components/Pie'
import TarjetaPostre from '../components/TarjetaPostre'
import {
  ETIQUETA_DISPONIBILIDAD,
  formatoPrecio,
  nombreEtiqueta,
  type Categoria,
  type Disponibilidad,
  type Producto,
} from '../lib/api'
import { precargar } from '../lib/cache'
import { CATEGORIAS, cargarCategorias, cargarEtiquetas, cargarProductos, claveProductos, ETIQUETAS } from '../lib/datos'
import { chipFiltro, enlaceDorado, hero, heroLinea, heroLineaChica, heroTitulo, pagina } from '../lib/estilos'
import { navegar, useRuta } from '../lib/router'
import { useNegocio } from '../lib/negocio'
import Link from '../components/Link'
import { rutaCotizar, useLista, vaciarLista } from '../lib/lista'
import { useDatos } from '../lib/useDatos'

const DISPONIBILIDADES: Disponibilidad[] = ['bajo pedido', 'stock', 'proximamente']
const sinAcentos = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()


const linea = 'mt-[26px] mb-3.5 w-full border-t border-tinto-oscuro/30'
const subtitulo = 'mb-2 font-titulo text-[25px] leading-[1.2] font-bold text-tinto-texto capitalize'
// Doble control deslizante: solo los círculos reciben el puntero
const rangoInput =
  'pointer-events-none absolute inset-0 m-0 w-full appearance-none bg-transparent [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-tinto-oscuro [&::-moz-range-thumb]:bg-beige [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:size-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-tinto-oscuro [&::-webkit-slider-thumb]:bg-beige'
// Casilla cuadrada del diseño (21:298) con palomita dibujada en ::after
const casilla =
  "m-0 grid size-[17px] cursor-pointer appearance-none place-content-center border border-black bg-[#d9d9d9] checked:border-tinto checked:bg-tinto checked:after:h-[9px] checked:after:w-[5px] checked:after:-translate-y-px checked:after:rotate-45 checked:after:border-r-2 checked:after:border-b-2 checked:after:border-white checked:after:content-['']"

/* PRODUCTOS (Figma 20:2) */
export default function Catalogo() {
  const { query } = useRuta()
  // Texto e imagen del hero: se editan en Panel → Configuración → Hero del menú
  const { catalogoPropio, catalogoImagen, catalogoLineas, cargando: cargandoNegocio } = useNegocio()
  const categorias = useDatos(CATEGORIAS, cargarCategorias)
  const etiquetas = useDatos(ETIQUETAS, cargarEtiquetas)

  const idEnUrl = Number(query.get('categoria')) || null
  const seleccionada =
    categorias.datos?.find((c) => c.id === idEnUrl) ?? categorias.datos?.[0] ?? null
  // Si la URL ya dice qué categoría, sus productos se piden junto con las categorías (no después)
  // (cuando ya llegaron las categorías manda la elegida, por si la de la URL ya no existe)
  const idProductos = categorias.datos ? (seleccionada?.id ?? null) : idEnUrl
  const productos = useDatos(
    idProductos ? claveProductos(idProductos) : null,
    cargarProductos(idProductos ?? 0),
  )
  const [viendo, setViendo] = useState<Producto | null>(null)
  const [filtrosAbiertos, setFiltrosAbiertos] = useState(false)
  const [busqueda, setBusqueda] = useState('')

  const precioMaximo = useMemo(() => {
    const max = Math.max(0, ...(productos.datos ?? []).map((p) => Number(p.precio)))
    return Math.max(100, Math.ceil(max / 100) * 100)
  }, [productos.datos])

  const [rango, setRango] = useState<[number, number] | null>(null)
  const [disp, setDisp] = useState<Disponibilidad[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [min, max] = rango ?? [0, precioMaximo]

  const texto = sinAcentos(busqueda.trim())
  const filtrados = (productos.datos ?? []).filter((p) => {
    const precio = Number(p.precio)
    if (precio < min || precio > max) return false
    if (disp.length && !disp.includes(p.disponibilidad)) return false
    if (tags.length && !p.etiquetas.some((e) => tags.includes(e))) return false
    if (texto && !sinAcentos(`${p.nombre} ${p.descripcion}`).includes(texto)) return false
    return true
  })
  const cantidadFiltros = disp.length + tags.length + (rango ? 1 : 0) + (texto ? 1 : 0)
  const limpiarFiltros = () => { setRango(null); setDisp([]); setTags([]); setBusqueda('') }

  const alternar = <T,>(lista: T[], valor: T) =>
    lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]

  const elegirCategoria = (c: Categoria) => {
    setRango(null)
    setFiltrosAbiertos(false)
    navegar(`/catalogo?categoria=${c.id}`, true)
  }
  const precargarCategoria = (c: Categoria) => precargar(claveProductos(c.id), cargarProductos(c.id))

  const lista = useLista()

  return (
    <div className={pagina}>
      {/* ÁREA 1 · HERO DEL MENÚ: título e imagen editables desde Configuración. */}
      <section className={`${hero} h-[480px] overflow-hidden bg-[linear-gradient(180deg,rgba(155,61,79,0)_-17.8%,#300e15_100%)]`}>
        {/* Foto que subió el negocio: de fondo a todo lo ancho, con degradado para que se lea el texto.
            Primera visita: mientras llega /negocio no se muestra la imagen ni el texto del diseño. */}
        {!cargandoNegocio && catalogoPropio && (
          <>
            <img src={catalogoPropio} className="absolute inset-0 h-full w-full object-cover" alt="" fetchPriority="high" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom_right,#2C1217_0%,transparent_75%)]" />
          </>
        )}
        <Encabezado />
        {/* Texto por encima de la foto (en celular va en flujo normal, antes de la ilustración) */}
        <div className="relative z-10 h-full max-[760px]:h-auto">
          <p className="absolute top-[136px] left-margen font-ui text-[17px] leading-[1.2] font-semibold text-white max-[760px]:static max-[760px]:mb-2.5">Nuestro catálogo</p>
          <h1 className={`${heroTitulo} top-[140px] h-[240px]`} aria-busy={cargandoNegocio}>
            {/* El primer renglón va un poco más chico, como en el diseño */}
            {!cargandoNegocio && catalogoLineas.map((l, i) => (
              <span key={i} className={i === 0 && catalogoLineas.length > 1 ? heroLineaChica : heroLinea}>{l}</span>
            ))}
          </h1>
        </div>
        {/* Sin foto propia: ilustración del diseño, a la derecha del texto (debajo en celular) */}
        {!cargandoNegocio && !catalogoPropio && (
          <img fetchPriority="high" className="pointer-events-none absolute top-[92px] left-[calc(50%+60px)] h-auto w-[612px] max-w-none max-[1280px]:top-[110px] max-[1280px]:-right-5 max-[1280px]:left-auto max-[1280px]:w-[520px] max-[1000px]:top-[150px] max-[1000px]:w-[420px] max-[760px]:static max-[760px]:mx-auto max-[760px]:mt-5 max-[760px]:w-full max-[760px]:max-w-[360px]" src={catalogoImagen} width={873} height={675} alt="" />
        )}
      </section>

      {/* CUERPO: panel de filtros a la izquierda y resultados a la derecha (apilados en celular). */}
      <div className="flex flex-1 items-stretch max-[760px]:flex-col">
        {/* ÁREA 2 · PANEL DE FILTROS: categorías, rango de precio, disponibilidad y etiquetas. En celular se pliega con el botón "Filtros". */}
        <aside className="relative z-1 w-[290px] flex-none bg-beige pt-14 pr-[26px] pb-[60px] pl-[30px] shadow-[4px_-4px_18px_rgba(0,0,0,0.18)] max-[1000px]:w-[250px] max-[1000px]:pl-5 max-[760px]:w-full max-[760px]:px-5 max-[760px]:py-5 max-[760px]:shadow-none" aria-label="Filtros">
          <h2 className="mb-3 pl-[26px] font-titulo text-[34px] leading-[1.2] font-bold max-[760px]:pl-0 max-[760px]:text-[28px]">Categorías</h2>
          {categorias.error && <MensajeError texto={categorias.error} reintentar={categorias.recargar} />}
          {/* En celular las categorías van en una fila deslizable; los demás filtros se despliegan con el botón */}
          {/* Lista de categorías (al pasar el mouse se precarga su contenido para que abra al instante). */}
          <ul className="flex flex-col gap-1.5 max-[760px]:-mx-5 max-[760px]:flex-row max-[760px]:overflow-x-auto max-[760px]:px-5 max-[760px]:pb-1">
            {categorias.datos?.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="h-12 w-full rounded-lg bg-beige px-3.5 text-left font-titulo text-[28px] leading-none font-bold text-tinto capitalize transition-colors hover:bg-tinto/10 aria-pressed:bg-tinto aria-pressed:text-beige max-[1000px]:text-2xl max-[760px]:h-10 max-[760px]:w-auto max-[760px]:whitespace-nowrap max-[760px]:border max-[760px]:border-tinto/30 max-[760px]:text-xl"
                  aria-pressed={c.id === seleccionada?.id}
                  onClick={() => elegirCategoria(c)}
                  onMouseEnter={() => precargarCategoria(c)}
                  onFocus={() => precargarCategoria(c)}
                >
                  {c.nombre}
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            className="mt-4 hidden h-10 w-full items-center justify-center gap-2 rounded-lg border border-tinto bg-white/50 font-ui text-[15px] font-semibold text-tinto max-[760px]:flex"
            aria-expanded={filtrosAbiertos}
            aria-controls="filtros-catalogo"
            onClick={() => setFiltrosAbiertos(!filtrosAbiertos)}
          >
            <SlidersHorizontal size={18} aria-hidden="true" />
            {filtrosAbiertos ? 'Ocultar filtros' : 'Filtros'}{cantidadFiltros > 0 && ` (${cantidadFiltros})`}
          </button>

          {/* Filtros secundarios: se aplican en el navegador, sin volver a pedir datos al servidor. */}
          <div id="filtros-catalogo" className={filtrosAbiertos ? '' : 'max-[760px]:hidden'}>
          <hr className={linea} />
          {/* Rango de precio con dos controles (mínimo y máximo). */}
          <h3 className={subtitulo}>Precio</h3>
          <div className="relative mt-[18px] mb-2 h-5 w-full">
            <div className="absolute top-[9px] right-2.5 left-2.5 h-0.5 bg-tinto-oscuro/25">
              <div
                className="absolute inset-y-0 bg-tinto-oscuro"
                style={{ left: `${(min / precioMaximo) * 100}%`, right: `${100 - (max / precioMaximo) * 100}%` }}
              />
            </div>
            <input
              className={rangoInput}
              type="range" min={0} max={precioMaximo} step={10} value={min}
              aria-label="Precio mínimo"
              onChange={(e) => setRango([Math.min(Number(e.target.value), max), max])}
            />
            <input
              className={rangoInput}
              type="range" min={0} max={precioMaximo} step={10} value={max}
              aria-label="Precio máximo"
              onChange={(e) => setRango([min, Math.max(Number(e.target.value), min)])}
            />
          </div>
          <div className="flex justify-between font-texto text-[15px] leading-[18px]">
            <span>{formatoPrecio(min).replace('.00', '')}</span>
            <span>{formatoPrecio(max).replace('.00', '')}</span>
          </div>

          <hr className={linea} />
          {/* Casillas de disponibilidad (en stock, por encargo, etc.). */}
          <h3 className={subtitulo}>Disponibilidad</h3>
          <div className="flex flex-col gap-2.5 pt-2.5 pl-4">
            {DISPONIBILIDADES.map((d) => (
              <label key={d} className="flex cursor-pointer items-center gap-3.5 font-texto text-base leading-5">
                <input type="checkbox" className={casilla} checked={disp.includes(d)} onChange={() => setDisp(alternar(disp, d))} />
                {ETIQUETA_DISPONIBILIDAD[d]}
              </label>
            ))}
          </div>

          <hr className={linea} />
          {/* Etiquetas del postre (sin gluten, vegano…) como botones tipo chip. */}
          <h3 className={subtitulo}>Etiquetas</h3>
          <div className="grid grid-cols-2 gap-x-2 gap-y-[9px] pt-3">
            {etiquetas.datos?.map((e) => (
              <button
                key={e.id}
                type="button"
                className={chipFiltro}
                aria-pressed={tags.includes(e.nombre)}
                onClick={() => setTags(alternar(tags, e.nombre))}
              >
                {nombreEtiqueta(e.nombre)}
              </button>
            ))}
          </div>
          <hr className={linea} />
          </div>
        </aside>

        {/* ÁREA 3 · RESULTADOS: nombre de la categoría, buscador, contador y cuadrícula de postres. */}
        <main className="flex-1 pt-9 pr-8 pb-[100px] pl-9 max-[760px]:px-4 max-[760px]:pt-7 max-[760px]:pb-[72px]">
          <h2 className="mb-5 font-titulo text-[66px] leading-none font-bold text-dorado [font-variant-caps:all-small-caps] max-[760px]:mb-4 max-[760px]:text-5xl">{seleccionada?.nombre ?? 'Catálogo'}</h2>
          {/* Barra superior: buscador (ignora acentos y mayúsculas), contador de resultados y "Limpiar filtros". */}
          <div className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            <input
              type="search"
              className="h-10 w-[300px] rounded-[20px] border border-rosa-vino bg-white px-4 font-texto text-[15px] max-[760px]:w-full"
              placeholder="Buscar postre…"
              aria-label="Buscar postre por nombre o descripción"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
            {productos.datos && (
              <p className="font-texto text-[15px] text-texto-secundario" role="status">
                {filtrados.length} {filtrados.length === 1 ? 'postre' : 'postres'}
              </p>
            )}
            {cantidadFiltros > 0 && (
              <button type="button" className={`${enlaceDorado} text-[15px]`} onClick={limpiarFiltros}>Limpiar filtros</button>
            )}
          </div>
          {/* Estados: error de carga, sin categorías, categoría vacía o filtros sin resultados. */}
          {productos.error && <MensajeError texto={productos.error} reintentar={productos.recargar} />}
          {categorias.datos?.length === 0 && <Vacio texto="Todavía no hay categorías." />}
          {productos.datos && productos.datos.length === 0 && <Vacio texto="Esta categoría todavía no tiene postres." />}
          {productos.datos && productos.datos.length > 0 && filtrados.length === 0 && (
            <Vacio texto="No hay postres con esos filtros." />
          )}
          {/* Cuadrícula de tarjetas (esqueletos mientras carga). Al tocar una se abre su detalle. */}
          <div className="grid grid-cols-[repeat(auto-fill,260px)] gap-x-5 gap-y-[22px] max-[760px]:justify-center">
            {(categorias.cargando || productos.cargando) && <EsqueletoPostres cantidad={6} />}
            {filtrados.map((p) => <TarjetaPostre key={p.id} producto={p} onVer={setViendo} />)}
          </div>
        </main>
      </div>
      {/* ÁREA 4 · PIE compartido. */}
      <Pie />
      {/* BARRA "MI LISTA PARA COTIZAR": aparece al marcar postres desde su detalle y los lleva juntos a la cita. */}
      {lista.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-[560px] items-center justify-between gap-3 rounded-2xl bg-tinto-oscuro px-5 py-3 font-ui text-sm font-semibold text-beige shadow-modal" role="status">
          <span>{lista.length} {lista.length === 1 ? 'postre' : 'postres'} en tu lista</span>
          <span className="flex items-center gap-3">
            <button type="button" className="underline-offset-2 hover:underline" onClick={vaciarLista}>Vaciar</button>
            <Link to={rutaCotizar(lista)} className="rounded-xl bg-beige px-4 py-2 text-tinto-texto hover:bg-white">Cotizar lista</Link>
          </span>
        </div>
      )}
      {/* VENTANA DE DETALLE del postre elegido. */}
      {viendo && <DetalleProducto producto={viendo} onCerrar={() => setViendo(null)} />}
    </div>
  )
}
