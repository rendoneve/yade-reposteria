import { CircleUserRound, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNegocio } from '../lib/negocio'
import { useRuta } from '../lib/router'
import { useSesion } from '../lib/sesion'
import Link from './Link'

const ENLACES = [
  { to: '/', texto: 'Inicio' },
  { to: '/acerca-de', texto: 'Acerca de' },
  { to: '/catalogo', texto: 'Menú' },
]

const AL_BAJAR = 24 // px de scroll a partir de los que el encabezado toma fondo

/* ENCABEZADO (Figma 20:54). Fijo arriba: transparente sobre el hero y, al bajar, vidrio esmerilado tinto.
   Se dibuja en <body> (portal) para quedar por encima de todo, aunque se use dentro del hero de cada página.
   En celular los enlaces van en un panel lateral que se abre con el botón de menú. */
export default function Encabezado() {
  const { path } = useRuta()
  const { logo, nombre } = useNegocio()
  const { usuario } = useSesion()
  const [solido, setSolido] = useState(() => window.scrollY > AL_BAJAR)
  // El menú queda abierto solo en la página donde se abrió: al navegar se cierra solo
  const [menuEn, setMenuEn] = useState<string | null>(null)
  const menuAbierto = menuEn === path
  const cerrarMenu = () => setMenuEn(null)

  useEffect(() => {
    const revisar = () => setSolido(window.scrollY > AL_BAJAR)
    window.addEventListener('scroll', revisar, { passive: true })
    return () => window.removeEventListener('scroll', revisar)
  }, [])

  useEffect(() => {
    if (!menuAbierto) return
    const alTeclear = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuEn(null) }
    document.addEventListener('keydown', alTeclear)
    document.body.style.overflow = 'hidden' // la página de atrás no se desplaza con el menú abierto
    return () => {
      document.removeEventListener('keydown', alTeclear)
      document.body.style.overflow = ''
    }
  }, [menuAbierto])

  const cuenta = !usuario
    ? { to: '/entrar', texto: 'Entrar' }
    : usuario.rol === 'admin'
      ? { to: '/admin', texto: 'Panel' }
      : { to: '/cuenta', texto: 'Mi cuenta' }

  return createPortal(
    <>
      <header
        className={`fixed inset-x-0 top-0 z-40 transition-[background-color,box-shadow,padding,backdrop-filter] duration-300 ease-suave ${
          solido
            ? 'bg-tinto-oscuro/75 py-2 shadow-[0_10px_30px_rgba(20,6,9,0.28)] backdrop-blur-md backdrop-saturate-150'
            : 'bg-transparent pt-4 pb-2'
        }`}
        style={{ viewTransitionName: 'encabezado' }}
      >
        <div className="relative mx-auto flex h-14 w-[min(1440px,calc(100%-48px))] items-center max-[760px]:w-[calc(100%-32px)]">
          <Link to="/" className="flex-none" aria-label="Inicio">
            <img
              className={`transition-[width] duration-300 ease-suave ${solido ? 'w-[88px]' : 'w-[104px]'} max-[760px]:w-[80px]`}
              src={logo}
              width={150}
              height={73}
              alt={nombre}
            />
          </Link>
          <nav
            className="absolute top-1/2 left-1/2 flex -translate-1/2 gap-16 font-ui text-base leading-[1.2] font-semibold text-white max-[1000px]:gap-9 max-[1000px]:text-[15px] max-[760px]:hidden"
            aria-label="Principal"
          >
            {ENLACES.map((e) => (
              <Link
                key={e.to}
                to={e.to}
                className="border-b-2 border-transparent pb-0.5 transition-colors duration-200 hover:border-caramelo aria-[current=page]:border-caramelo"
                aria-current={path === e.to ? 'page' : undefined}
              >
                {e.texto}
              </Link>
            ))}
          </nav>
          <Link
            to={cuenta.to}
            className="ml-auto mr-4 flex items-center gap-1.5 font-ui text-base leading-none font-semibold text-white transition-colors duration-200 hover:text-caramelo max-[760px]:hidden"
            aria-current={path.startsWith(cuenta.to) ? 'page' : undefined}
          >
            <CircleUserRound size={22} aria-hidden="true" />
            <span>{cuenta.texto}</span>
          </Link>
          <Link
            to="/agendar"
            className="flex h-[42px] items-center rounded-xl bg-beige px-[22px] font-ui text-lg leading-none text-tinto-texto transition-[background-color,transform] duration-200 ease-suave hover:bg-white active:scale-[0.97] max-[760px]:ml-auto max-[760px]:h-9 max-[760px]:px-3.5 max-[760px]:text-[15px]"
          >
            Agendar cita
          </Link>
          <button
            type="button"
            className="ml-2 hidden size-10 place-items-center rounded-xl text-white transition-colors hover:bg-white/10 max-[760px]:grid"
            aria-label="Abrir menú"
            aria-expanded={menuAbierto}
            aria-controls="menu-movil"
            onClick={() => setMenuEn(path)}
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {menuAbierto && (
        <div className="fixed inset-0 z-50 min-[761px]:hidden" id="menu-movil">
          <button
            type="button"
            className="fondo-entrar absolute inset-0 bg-[rgb(20_6_9/0.45)] backdrop-blur-sm"
            aria-label="Cerrar menú"
            onClick={cerrarMenu}
          />
          <aside
            className="panel-entrar absolute inset-y-0 right-0 flex w-[min(320px,85vw)] flex-col bg-tinto-oscuro/95 px-6 pt-5 pb-8 shadow-[-20px_0_50px_rgba(20,6,9,0.35)] backdrop-blur-xl"
            aria-label="Menú"
          >
            <div className="mb-8 flex items-center justify-between">
              <img className="w-[80px]" src={logo} width={150} height={73} alt={nombre} />
              <button
                type="button"
                className="grid size-10 place-items-center rounded-xl text-white transition-colors hover:bg-white/10"
                aria-label="Cerrar menú"
                onClick={cerrarMenu}
              >
                <X size={24} />
              </button>
            </div>
            <nav className="flex flex-col gap-1" aria-label="Principal">
              {[...ENLACES, cuenta].map((e) => (
                <Link
                  key={e.to}
                  to={e.to}
                  onClick={cerrarMenu}
                  className="rounded-xl px-4 py-3 font-titulo text-[26px] leading-none font-bold text-beige transition-colors hover:bg-white/10 aria-[current=page]:bg-tinto"
                  aria-current={(e.to === '/' ? path === '/' : path.startsWith(e.to)) ? 'page' : undefined}
                >
                  {e.texto}
                </Link>
              ))}
            </nav>
            <Link
              to="/agendar"
              onClick={cerrarMenu}
              className="mt-auto flex h-12 items-center justify-center rounded-xl bg-beige font-ui text-lg text-tinto-texto transition-colors hover:bg-white"
            >
              Agendar cita
            </Link>
          </aside>
        </div>
      )}
    </>,
    document.body,
  )
}
