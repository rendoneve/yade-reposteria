import { Quote } from 'lucide-react'
import { formatoDia, type Resena } from '../lib/api'
import { chipProducto } from '../lib/estilos'
import { Estrellas } from './Estrellas'

/* Reseña de un cliente para el sitio público (carrusel del inicio). */
export default function TarjetaResena({ resena }: { resena: Resena }) {
  const productos = resena.productos.slice(0, 2)
  const resto = resena.productos.length - productos.length
  return (
    <article className="relative flex w-[340px] flex-none snap-start flex-col gap-3 rounded-[18px] bg-crema px-7 pt-8 pb-6 shadow-tarjeta max-[560px]:w-[85vw]">
      <Quote size={34} className="absolute top-4 right-5 text-caramelo" aria-hidden="true" fill="currentColor" strokeWidth={0} />
      {resena.calificacion ? <Estrellas valor={resena.calificacion} /> : <span className="h-[18px]" />}
      <p className="line-clamp-6 flex-1 font-texto text-[17px] leading-[1.5] whitespace-pre-line text-black">
        “{resena.descripcion}”
      </p>
      {productos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Postres reseñados">
          {productos.map((p) => <li key={p.id} className={chipProducto}>{p.nombre}</li>)}
          {resto > 0 && <li className={chipProducto}>+{resto}</li>}
        </ul>
      )}
      <div className="flex items-baseline justify-between gap-3 border-t border-tinto-texto/15 pt-3">
        <p className="truncate font-ui text-[15px] font-semibold text-tinto-texto">{resena.nombre_cliente}</p>
        <p className="flex-none font-ui text-xs font-semibold text-dorado-texto">{formatoDia(resena.fecha)}</p>
      </div>
    </article>
  )
}
