import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef } from 'react'
import { cargarResenasInicio, cargarResumenResenas, RESENAS_INICIO, RESUMEN_RESENAS } from '../lib/datos'
import { useDatos } from '../lib/useDatos'
import { Estrellas } from './Estrellas'
import { MensajeError } from './Estado'
import Link from './Link'
import TarjetaResena from './TarjetaResena'

const flecha =
  'grid h-11 w-11 place-items-center rounded-full border border-tinto-oscuro bg-beige text-tinto-oscuro transition-colors hover:bg-tinto-oscuro hover:text-white'

/* Opiniones reales de los clientes (solo las que el administrador aprobó), en un carrusel que se desliza. */
export default function SeccionResenas() {
  const resenas = useDatos(RESENAS_INICIO, cargarResenasInicio)
  const resumen = useDatos(RESUMEN_RESENAS, cargarResumenResenas)
  const pista = useRef<HTMLDivElement>(null)
  const mover = (dir: 1 | -1) => {
    const el = pista.current
    if (el) el.scrollBy({ left: dir * Math.min(el.clientWidth * 0.8, 720), behavior: 'smooth' })
  }

  const r = resumen.datos
  const lista = resenas.datos ?? []

  return (
    <section className="mx-auto mt-[88px] w-full max-w-[1440px] max-[760px]:mt-16" aria-labelledby="titulo-resenas">
      <h2 id="titulo-resenas" className="aparecer text-center font-ui text-[52px] leading-[1.2] font-bold text-dorado max-[760px]:text-4xl">
        Lo que dicen nuestros clientes
      </h2>
      {r && r.promedio !== null && r.con_calificacion > 0 && (
        <p className="aparecer mt-3 mb-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-ui text-lg font-semibold text-tinto-texto">
          <Estrellas valor={r.promedio} tamano={22} />
          <span>{r.promedio.toFixed(1)} de 5</span>
          <span className="font-texto font-normal text-texto-secundario">· {r.total} {r.total === 1 ? 'reseña' : 'reseñas'}</span>
        </p>
      )}
      {!(r && r.promedio !== null) && <div className="mb-10" />}

      {resenas.error && <MensajeError texto={resenas.error} reintentar={resenas.recargar} />}

      {resenas.cargando && (
        <div className="flex gap-5 overflow-hidden" aria-hidden="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-[260px] w-[340px] flex-none animate-pulse rounded-[18px] bg-crema max-[560px]:w-[85vw]" />)}
        </div>
      )}

      {resenas.datos && lista.length === 0 && (
        <div className="mx-auto max-w-[560px] rounded-[18px] bg-crema px-8 py-10 text-center shadow-tarjeta">
          <p className="font-titulo text-[30px] leading-[1.1] font-bold text-tinto-texto">Sé el primero en opinar</p>
          <p className="mt-2 font-texto text-lg leading-normal text-[#333]">
            Agenda una cita y, cuando termine, cuéntanos qué te parecieron tus postres.
          </p>
        </div>
      )}

      {lista.length > 0 && (
        <div className="relative">
          <div
            ref={pista}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth px-1 pt-1 pb-6 [scrollbar-width:thin]"
            role="region"
            aria-label="Reseñas de clientes"
            tabIndex={0}
          >
            {lista.map((x) => <TarjetaResena key={x.id} resena={x} />)}
          </div>
          {lista.length > 2 && (
            <div className="mt-2 flex justify-center gap-3">
              <button type="button" className={flecha} onClick={() => mover(-1)} aria-label="Reseñas anteriores"><ChevronLeft size={22} /></button>
              <button type="button" className={flecha} onClick={() => mover(1)} aria-label="Más reseñas"><ChevronRight size={22} /></button>
            </div>
          )}
        </div>
      )}

      <p className="mt-8 text-center font-texto text-base text-texto-secundario">
        ¿Ya probaste nuestros postres?{' '}
        <Link to="/cuenta/resenas" className="font-ui font-semibold text-dorado-texto hover:underline">Deja tu reseña →</Link>
      </p>
    </section>
  )
}
