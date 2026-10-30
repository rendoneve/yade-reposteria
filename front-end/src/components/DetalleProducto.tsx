import postreEjemplo from '../assets/img/postre-ejemplo.webp'
import { api, ETIQUETA_DISPONIBILIDAD, formatoDia, formatoPrecio, nombreEtiqueta, type Producto, type Resena } from '../lib/api'
import { botonOscuro, chipProducto } from '../lib/estilos'
import { alternarEnLista, useLista } from '../lib/lista'
import { useDatos } from '../lib/useDatos'
import { Cargando } from './Estado'
import Link from './Link'
import Modal from './Modal'

/* Detalle de un postre: foto grande, descripción completa, etiquetas y lo que opinan los clientes. */
export default function DetalleProducto({ producto, onCerrar }: { producto: Producto; onCerrar: () => void }) {
  const resenas = useDatos(`resenas:producto:${producto.id}`, () =>
    api<Resena[]>('/resenas', { params: { producto_id: producto.id, limit: 10 } }),
  )
  const lista = useLista()
  const enLista = lista.includes(producto.id)
  return (
    <Modal titulo={producto.nombre} onCerrar={onCerrar}>
      <img
        className="mb-4 aspect-[4/3] w-full rounded-xl object-cover"
        src={producto.imagen_url || postreEjemplo}
        alt={producto.nombre}
      />
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-ui text-2xl font-bold text-tinto">
          <span className="mr-1 text-sm font-semibold text-texto-secundario">Desde</span>
          {formatoPrecio(producto.precio)}
        </p>
        <p className="font-ui text-sm font-semibold text-dorado-texto">
          {producto.categoria_nombre && `${producto.categoria_nombre} · `}{ETIQUETA_DISPONIBILIDAD[producto.disponibilidad]}
        </p>
      </div>
      {producto.etiquetas.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5" aria-label="Etiquetas">
          {producto.etiquetas.map((e) => <li key={e} className={chipProducto}>{nombreEtiqueta(e)}</li>)}
        </ul>
      )}
      {producto.descripcion && <p className="mb-5 font-texto text-base leading-normal whitespace-pre-line">{producto.descripcion}</p>}
      <p className="mb-3 font-texto text-[13px] text-texto-secundario">
        Precio de referencia: el costo final se confirma en tu cotización.
      </p>
      {/* Dos caminos: cotizar solo este postre, o sumarlo a la lista para cotizar varios juntos */}
      <div className="flex flex-col gap-2.5">
        <Link to={`/agendar?producto=${producto.id}`} className={`${botonOscuro} flex w-full items-center justify-center`}>
          Cotizar este postre
        </Link>
        <button
          type="button"
          className="h-[42px] w-full rounded-2xl border border-tinto-oscuro font-texto text-[17px] text-tinto-oscuro transition-colors hover:bg-tinto-oscuro/10 aria-pressed:bg-tinto-oscuro/10"
          aria-pressed={enLista}
          onClick={() => alternarEnLista(producto.id)}
        >
          {enLista ? '✓ En mi lista para cotizar (quitar)' : 'Agregar a mi lista para cotizar'}
        </button>
      </div>

      <h3 className="mt-6 mb-2 font-titulo text-[26px] leading-[1.2] font-bold text-tinto-texto">Lo que dicen nuestros clientes</h3>
      {resenas.cargando && <Cargando />}
      {resenas.datos?.length === 0 && (
        <p className="font-texto text-[15px] text-texto-secundario">Todavía no hay reseñas de este postre.</p>
      )}
      <ul className="flex flex-col gap-3">
        {resenas.datos?.map((r) => (
          <li key={r.id} className="rounded-xl bg-white/60 px-4 py-3">
            <p className="font-texto text-[15px] leading-normal whitespace-pre-line">“{r.descripcion}”</p>
            <p className="mt-1 font-ui text-xs font-semibold text-texto-secundario">{r.nombre_cliente} · {formatoDia(r.fecha)}</p>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
