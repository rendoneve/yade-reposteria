import { Clock, MapPin, MessageCircle } from 'lucide-react'
import { estadoHoy, useNegocio } from '../lib/negocio'
import Link from './Link'

/* Cierre de la página: invitación a agendar y todo lo necesario para contactar o llegar. */
export default function LlamadoFinal() {
  const { negocio, nombre } = useNegocio()
  const hoy = estadoHoy(negocio?.horarios)
  const whatsapp = negocio?.whatsapp?.replace(/\D/g, '')

  return (
    <section className="aparecer mx-auto mt-[88px] w-full max-w-[1440px] overflow-hidden rounded-[24px] bg-tinto-oscuro bg-[linear-gradient(135deg,#59252f_0%,#35151b_70%)] px-12 py-14 text-center shadow-modal max-[760px]:mt-16 max-[760px]:px-6 max-[760px]:py-10" aria-labelledby="titulo-final">
      <h2 id="titulo-final" className="font-titulo text-[56px] leading-[1.05] font-bold text-beige [font-variant-caps:all-small-caps] max-[760px]:text-[40px]">
        ¿Celebras algo especial?
      </h2>
      <p className="mx-auto mt-3 max-w-[620px] font-texto text-xl leading-normal text-beige/85">
        Cuéntanos qué necesitas y en {nombre} lo preparamos para ti, con el mismo cariño de siempre.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3.5">
        <Link to="/agendar" className="h-[50px] rounded-3xl bg-beige px-9 font-texto text-[19px] leading-[50px] text-tinto-oscuro transition-colors hover:bg-white">
          Agendar cita
        </Link>
        {whatsapp && (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-[50px] items-center gap-2 rounded-3xl border border-beige px-7 font-texto text-[19px] text-beige transition-colors hover:bg-beige/10"
          >
            <MessageCircle size={20} aria-hidden="true" /> Escríbenos por WhatsApp
          </a>
        )}
      </div>
      {(negocio?.ubicacion || hoy) && (
        <ul className="mt-9 flex flex-wrap justify-center gap-x-8 gap-y-3 border-t border-beige/20 pt-6 font-texto text-base text-beige/85">
          {negocio?.ubicacion && (
            <li className="flex items-center gap-2">
              <MapPin size={18} aria-hidden="true" className="text-caramelo" />
              <span className="whitespace-pre-line">{negocio.ubicacion}</span>
              {negocio.mapa_url && (
                <a href={negocio.mapa_url} target="_blank" rel="noreferrer" className="font-ui font-semibold text-caramelo hover:underline">Ver mapa</a>
              )}
            </li>
          )}
          {hoy && (
            <li className="flex items-center gap-2">
              <Clock size={18} aria-hidden="true" className="text-caramelo" />
              <span>{hoy.titulo} · {hoy.detalle}</span>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
