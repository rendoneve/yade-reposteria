import postreEjemplo from '../assets/img/postre-ejemplo.webp'
import { api, ETIQUETA_DISPONIBILIDAD, formatoDia, formatoPrecio, nombreEtiqueta, type Producto, type Resena } from '../lib/api'
import { botonOscuro, chipProducto } from '../lib/estilos'
import { useDatos } from '../lib/useDatos'
import { Cargando } from './Estado'
import Link from './Link'
import Modal from './Modal'

/* Detalle de un postre: foto grande, descripción completa, etiquetas y lo que opinan los clientes. */
export default function DetalleProducto({ producto, onCerrar }: { producto: Producto; onCerrar: () => void }) {
  const resenas = useDatos(`resenas:producto:${producto.id}`, () =>
    api<Resena[]>('/resenas', { params: { producto_id: producto.id, limit: 10 } }),
  )
  return (
    <Modal titulo={producto.nombre} onCerrar={onCerrar}>
      <img
        className="mb-4 aspect-[4/3] w-full rounded-xl object-cover"
        src={producto.imagen_url || postreEjemplo}
        alt={producto.nombre}
      />
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-ui text-2xl font-bold text-tinto">{formatoPrecio(producto.precio)}</p>
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
      <Link to={`/agendar?producto=${producto.id}`} className={`${botonOscuro} flex w-full items-center justify-center`}>
        Agendar cita con este postre
      </Link>

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
