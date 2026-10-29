import { CircleUserRound } from 'lucide-react'
import { useSesion } from '../lib/sesion'
import { useNegocio } from '../lib/negocio'
import Link from './Link'
import { useRuta } from '../lib/router'

const ENLACES = [
  { to: '/', texto: 'Inicio' },
  { to: '/acerca-de', texto: 'Acerca de' },
  { to: '/catalogo', texto: 'Menú' },
]

/* ENCABEZADO (Figma 20:54) */
export default function Encabezado() {
  const { path } = useRuta()
  const { logo, nombre } = useNegocio()
  const { usuario } = useSesion()
  const cuenta = !usuario
    ? { to: '/entrar', texto: 'Entrar' }
    : usuario.rol === 'admin'
      ? { to: '/admin', texto: 'Panel' }
      : { to: '/cuenta', texto: 'Mi cuenta' }
  return (
    <header className="absolute top-4 left-1/2 z-5 flex h-14 w-[min(1440px,calc(100%-48px))] -translate-x-1/2 items-center max-[760px]:h-auto max-[760px]:flex-wrap max-[760px]:gap-2.5">
      <Link to="/" className="flex-none" aria-label="Inicio">
        <img className="w-[104px] max-[760px]:w-[84px]" src={logo} width={150} height={73} alt={nombre} />
      </Link>
      <nav
        className="absolute top-1/2 left-1/2 flex -translate-1/2 gap-16 font-ui text-base leading-[1.2] font-semibold text-white max-[1000px]:gap-9 max-[1000px]:text-[15px] max-[760px]:static max-[760px]:order-3 max-[760px]:w-full max-[760px]:translate-0 max-[760px]:justify-center max-[760px]:gap-7"
        aria-label="Principal"
      >
        {ENLACES.map((e) => (
          <Link
            key={e.to}
            to={e.to}
            className="border-b-2 border-transparent pb-0.5 transition-colors hover:border-caramelo"
            aria-current={path === e.to ? 'page' : undefined}
          >
            {e.texto}
          </Link>
        ))}
      </nav>
      <Link
        to={cuenta.to}
        className="ml-auto mr-4 flex items-center gap-1.5 font-ui text-base leading-none font-semibold text-white transition-colors hover:text-caramelo max-[760px]:mr-3.5"
        aria-current={path.startsWith(cuenta.to) ? 'page' : undefined}
      >
        <CircleUserRound size={22} aria-hidden="true" />
        <span className="max-[760px]:sr-only">{cuenta.texto}</span>
      </Link>
      <Link
        to="/agendar"
        className="flex h-[42px] items-center rounded-xl bg-beige px-[22px] font-ui text-lg leading-none text-tinto-texto transition-colors hover:bg-white max-[760px]:h-[38px] max-[760px]:px-3.5 max-[760px]:text-[15px]"
      >
        Agendar cita
      </Link>
    </header>
  )
}
