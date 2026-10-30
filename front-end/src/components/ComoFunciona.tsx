import { Cake, CalendarCheck, Gift } from 'lucide-react'
import Link from './Link'

const pasos = [
  { icono: Cake, titulo: 'Elige tus postres', texto: 'Recorre el menú y quédate con lo que se te antoje: pasteles, individuales o especiales.' },
  { icono: CalendarCheck, titulo: 'Agenda tu cita', texto: 'Escoge el día y la hora que mejor te acomoden. Verás al instante los horarios disponibles.' },
  { icono: Gift, titulo: 'Recoge y disfruta', texto: 'Pasa por tu pedido, compártelo y cuéntanos qué te pareció dejando tu reseña.' },
]

/* Tres pasos para que quien llega por primera vez sepa exactamente qué hacer. */
export default function ComoFunciona() {
  return (
    <section className="mx-auto mt-[88px] w-full max-w-[1440px] max-[760px]:mt-16" aria-labelledby="titulo-pasos">
      <h2 id="titulo-pasos" className="aparecer mb-10 text-center font-ui text-[52px] leading-[1.2] font-bold text-dorado max-[760px]:text-4xl">
        Así de fácil
      </h2>
      <ol className="grid grid-cols-3 gap-6 max-[1000px]:grid-cols-1">
        {pasos.map(({ icono: Icono, titulo, texto }, i) => (
          <li key={titulo} className="aparecer relative flex flex-col items-center gap-3 rounded-[18px] bg-crema px-8 pt-12 pb-8 text-center shadow-tarjeta">
            <span className="absolute -top-5 grid h-11 w-11 place-items-center rounded-full bg-tinto-oscuro font-titulo text-[26px] leading-none font-bold text-beige">
              {i + 1}
            </span>
            <Icono size={42} className="text-dorado" strokeWidth={1.5} aria-hidden="true" />
            <h3 className="font-titulo text-[30px] leading-[1.1] font-bold text-tinto-texto">{titulo}</h3>
            <p className="font-texto text-[17px] leading-normal text-[#333]">{texto}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8 text-center">
        <Link
          to="/agendar"
          className="inline-block h-[46px] rounded-3xl bg-tinto-oscuro px-8 font-texto text-[18px] leading-[46px] text-white transition-colors hover:bg-tinto"
        >
          Empezar ahora
        </Link>
      </div>
    </section>
  )
}
