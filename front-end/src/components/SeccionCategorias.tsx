import { ArrowRight, Cake } from 'lucide-react'
import { cargarCategorias, CATEGORIAS } from '../lib/datos'
import { precargar } from '../lib/cache'
import { claveProductos, cargarProductos } from '../lib/datos'
import { useDatos } from '../lib/useDatos'
import Link from './Link'

/* "Encuentra tu antojo": un mosaico de las categorías del menú; cada una lleva directo a ella. */
export default function SeccionCategorias() {
  const { datos } = useDatos(CATEGORIAS, cargarCategorias)
  const categorias = (datos ?? []).filter((c) => c.cantidad_productos > 0).slice(0, 6)
  if (categorias.length === 0) return null

  return (
    <section className="mx-auto mt-[88px] w-full max-w-[1440px] max-[760px]:mt-16" aria-labelledby="titulo-categorias">
      <h2 id="titulo-categorias" className="aparecer text-center font-ui text-[52px] leading-[1.2] font-bold text-dorado max-[760px]:text-4xl">
        Encuentra tu antojo
      </h2>
      <p className="aparecer mx-auto mt-2 mb-10 max-w-[560px] text-center font-texto text-lg leading-normal text-texto-secundario">
        Elige una categoría y descubre todo lo que preparamos para ti.
      </p>
      <ul className="grid grid-cols-3 gap-5 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1">
        {categorias.map((c) => (
          <li key={c.id} className="aparecer">
            <Link
              to={`/catalogo?categoria=${c.id}`}
              className="group relative block aspect-[4/3] overflow-hidden rounded-[18px] bg-tinto shadow-tarjeta"
              onMouseEnter={() => precargar(claveProductos(c.id), cargarProductos(c.id))}
              onFocus={() => precargar(claveProductos(c.id), cargarProductos(c.id))}
            >
              {!c.imagen_url && <Cake size={110} strokeWidth={1} aria-hidden="true" className="absolute top-6 right-6 text-beige/15" />}
              {c.imagen_url && (
                <img
                  src={c.imagen_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-suave group-hover:scale-105"
                />
              )}
              <span className="absolute inset-0 bg-[linear-gradient(to_top,rgba(48,14,21,0.9)_0%,rgba(48,14,21,0.15)_60%,transparent_100%)]" />
              <span className="absolute right-5 bottom-4 left-5 flex items-end justify-between gap-3">
                <span className="flex flex-col">
                  <span className="font-titulo text-[32px] leading-none font-bold text-white">{c.nombre}</span>
                  <span className="mt-1 font-texto text-[15px] text-beige/85">
                    {c.cantidad_productos} {c.cantidad_productos === 1 ? 'postre' : 'postres'}
                  </span>
                </span>
                <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-beige text-tinto-oscuro transition-transform duration-300 group-hover:translate-x-1">
                  <ArrowRight size={20} aria-hidden="true" />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
