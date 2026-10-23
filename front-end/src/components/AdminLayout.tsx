import type { ReactNode } from 'react'
import logo from '../assets/img/logo-yade.png'
import { useSesion } from '../lib/auth'
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
  const activo = (to: string) => (to === '/admin' ? path === '/admin' : path.startsWith(to))

  return (
    <div className="admin">
      <header className="admin__barra">
        <Link to="/admin" className="admin__logo" aria-label="Inicio del panel">
          <img src={logo} width={150} height={73} alt="Yade" />
        </Link>
        <div className="admin__sesion">
          <span>{usuario?.username}</span>
          <Link to="/">Ver sitio</Link>
          <button type="button" onClick={salir}>Salir</button>
        </div>
      </header>
      <div className="admin__cuerpo">
        <nav className="admin__menu" aria-label="Panel">
          {MENU.map((m) => (
            <Link key={m.to} to={m.to} className="admin__item" aria-current={activo(m.to) ? 'page' : undefined}>
              {m.texto}
            </Link>
          ))}
        </nav>
        <main className="admin__contenido">
          <div className="admin__cabecera">
            <h1 className="admin__titulo">{titulo}</h1>
          </div>
          {acciones && <div className="admin__acciones">{acciones}</div>}
          {children}
        </main>
      </div>
      <Pie />
    </div>
  )
}
