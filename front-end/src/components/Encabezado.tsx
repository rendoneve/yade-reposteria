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
    <header className="encabezado">
      <Link to="/" className="encabezado__logo" aria-label="Inicio">
        <img src={logo} width={150} height={73} alt="Yade" />
      </Link>
      <nav className="encabezado__nav" aria-label="Principal">
        {ENLACES.map((e) => (
          <Link key={e.to} to={e.to} aria-current={path === e.to ? 'page' : undefined}>
            {e.texto}
          </Link>
        ))}
      </nav>
      <div className="encabezado__acciones">
        <Link to="/admin" className="encabezado__usuario" aria-label="Administración">
          <img src={iconoUsuario} width={40} height={40} alt="" />
        </Link>
        <Link to="/agendar" className="encabezado__cita">
          Agendar cita
        </Link>
      </div>
    </header>
  )
}
