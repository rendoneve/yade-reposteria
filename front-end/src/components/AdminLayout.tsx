import type { ReactNode } from 'react'
import { useSesion } from '../lib/auth'
import { useNegocio } from '../lib/negocio'
import { Link, useRuta } from '../lib/router'
import Pie from './Pie'

const MENU = [
  { to: '/admin', texto: 'Inicio' },
  { to: '/admin/productos', texto: 'Productos' },
  { to: '/admin/citas', texto: 'Citas' },
  { to: '/admin/paquetes', texto: 'Paquetes' },
  { to: '/admin/resenas', texto: 'Reseñas' },
  { to: '/admin/configuracion', texto: 'Configuracion' },
]

/* Estructura común de las pantallas ADMINISTRADOR (barra superior, menú lateral, pie). */
export default function AdminLayout({ titulo, acciones, children }: { titulo: string; acciones?: ReactNode; children: ReactNode }) {
  const { path } = useRuta()
  const { usuario, salir } = useSesion()
  const { logo, nombre } = useNegocio()
  const activo = (to: string) => (to === '/admin' ? path === '/admin' : path.startsWith(to))

  return (
    <div className="flex min-h-screen flex-col bg-beige">
      <header className="flex h-[76px] flex-none items-center justify-between border-b border-tinto bg-tinto-oscuro pr-8 pl-14 max-[960px]:px-4">
        <Link to="/admin" aria-label="Inicio del panel">
          <img className="w-24" src={logo} width={150} height={73} alt={nombre} />
        </Link>
        <div className="flex items-center gap-[18px] font-ui text-sm leading-none text-beige">
          <span>{usuario?.username}</span>
          <Link to="/" className="hover:text-white">Ver sitio</Link>
          <button
            type="button"
            className="rounded-2xl border border-rosa-vino px-3.5 py-1.5 text-[13px] hover:text-white"
            onClick={salir}
          >
            Salir
          </button>
        </div>
      </header>
      <div className="flex min-h-[calc(100vh-76px-110px)] flex-1 max-[960px]:min-h-0 max-[960px]:flex-col">
        <nav
          className="flex w-62 flex-none flex-col gap-1 bg-tinto-oscuro pt-7 pr-4 pb-8 pl-3.5 max-[960px]:w-full max-[960px]:flex-row max-[960px]:flex-wrap max-[960px]:px-3 max-[960px]:py-2.5"
          aria-label="Panel"
        >
          {MENU.map((m) => (
            <Link
              key={m.to}
              to={m.to}
              className="flex h-[46px] items-center rounded-lg pl-3.5 font-titulo text-[26px] leading-none font-bold text-beige capitalize transition-colors hover:bg-tinto/50 aria-[current=page]:bg-tinto max-[960px]:h-[38px] max-[960px]:px-3 max-[960px]:text-[21px]"
              aria-current={activo(m.to) ? 'page' : undefined}
            >
              {m.texto}
            </Link>
          ))}
        </nav>
        <main className="max-w-[1640px] min-w-0 flex-1 pt-[30px] pr-8 pb-14 pl-9 max-[960px]:px-4 max-[960px]:pt-6">
          <div className="mb-6 flex min-h-[52px] items-center justify-between gap-5 max-[960px]:flex-wrap">
            <h1 className="font-titulo text-[44px] leading-[1.1] font-bold text-tinto-texto capitalize max-[960px]:text-4xl">{titulo}</h1>
          </div>
          {acciones && <div className="-mt-2 flex justify-end">{acciones}</div>}
          {children}
        </main>
      </div>
      <Pie />
    </div>
  )
}
