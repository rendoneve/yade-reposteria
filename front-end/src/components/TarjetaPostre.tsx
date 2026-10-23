import postreEjemplo from '../assets/img/postre-ejemplo.png'
import { formatoPrecio, type Producto } from '../lib/api'
import { Link } from '../lib/router'

/* Tarjeta de postre (Figma 21:106). La foto viene del producto; si no tiene, se usa la del diseño. */
export default function TarjetaPostre({ producto }: { producto: Producto }) {
  return (
    <article className="tarjeta-postre">
      <img
        className="tarjeta-postre__foto"
        src={producto.imagen_url || postreEjemplo}
        alt={producto.nombre}
        loading="lazy"
      />
      <h3 className="tarjeta-postre__nombre">{producto.nombre}</h3>
      <p className="tarjeta-postre__descripcion">{producto.descripcion}</p>
      <p className="tarjeta-postre__precio">{formatoPrecio(producto.precio)}</p>
      <Link className="tarjeta-postre__boton" to={`/agendar?producto=${producto.id}`}>
        Agendar cita
      </Link>
    </article>
  )
}
