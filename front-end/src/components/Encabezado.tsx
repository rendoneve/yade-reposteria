import logo from '../assets/img/logo-yade.png'
import iconoUsuario from '../assets/img/icono-usuario.png'
import { Link, useRuta } from '../lib/router'

const ENLACES = [
  { to: '/', texto: 'Inicio' },
  { to: '/acerca-de', texto: 'Acerca de' },
  { to: '/catalogo', texto: 'Menu' },
]

/* ENCABEZADO (Figma 20:54) */
export default function Encabezado() {
  const { path } = useRuta()
  return (
    <header className="absolute top-4 left-1/2 z-5 flex h-14 w-[min(1440px,calc(100%-48px))] -translate-x-1/2 items-center max-[760px]:h-auto max-[760px]:flex-wrap max-[760px]:gap-2.5">
      <Link to="/" className="flex-none" aria-label="Inicio">
        <img className="w-[104px] max-[760px]:w-[84px]" src={logo} width={150} height={73} alt="Yade" />
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
      <div className="ml-auto flex items-center gap-3">
        <Link to="/admin" aria-label="Administración">
          <img className="size-[30px]" src={iconoUsuario} width={40} height={40} alt="" />
        </Link>
        <Link
          to="/agendar"
          className="flex h-[42px] items-center rounded-xl bg-beige px-[22px] font-ui text-lg leading-none text-tinto-texto transition-colors hover:bg-white max-[760px]:h-[38px] max-[760px]:px-3.5 max-[760px]:text-[15px]"
        >
          Agendar cita
        </Link>
      </div>
    </header>
  )
}
