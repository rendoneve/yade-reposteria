import postreEjemplo from '../assets/img/postre-ejemplo.png'
import { formatoPrecio, type Producto } from '../lib/api'
import { Link } from '../lib/router'

/* Tarjeta de postre (Figma 21:106). La foto viene del producto; si no tiene, se usa la del diseño. */
export default function TarjetaPostre({ producto }: { producto: Producto }) {
  return (
    <article className="relative flex h-[362px] w-[260px] flex-col overflow-hidden rounded-[10px] border border-tinto-oscuro bg-beige shadow-[0_4px_10px_rgba(48,14,21,0.25)] transition duration-200 hover:-translate-y-[3px] hover:shadow-[0_10px_22px_rgba(48,14,21,0.28)]">
      <img
        className="h-60 w-full flex-none object-cover"
        src={producto.imagen_url || postreEjemplo}
        alt={producto.nombre}
        loading="lazy"
      />
      <h3 className="mx-3.5 mt-1.5 truncate font-texto text-base leading-5 font-bold">{producto.nombre}</h3>
      <p className="mt-0.5 mr-2.5 ml-3.5 line-clamp-2 h-7 font-texto text-xs leading-[14px] text-[#333]">
        {producto.descripcion}
      </p>
      <p className="mx-3.5 mt-0.5 font-texto text-base leading-5">{formatoPrecio(producto.precio)}</p>
      <Link
        className="absolute right-3 bottom-[9px] left-3 h-[30px] rounded-[15px] bg-tinto-oscuro text-center font-texto text-[15px] leading-[30px] text-white transition-colors hover:bg-tinto"
        to={`/agendar?producto=${producto.id}`}
      >
        Agendar cita
      </Link>
    </article>
  )
}
