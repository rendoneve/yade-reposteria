import { Cargando } from './components/Estado'
import { ProveedorSesion, useSesion } from './lib/auth'
import { fondoLogin } from './lib/estilos'
import { useRuta } from './lib/router'
import AcercaDe from './pages/AcercaDe'
import AgendarCita from './pages/AgendarCita'
import Catalogo from './pages/Catalogo'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import Citas from './pages/admin/Citas'
import Panel from './pages/admin/Panel'
import Productos from './pages/admin/Productos'
import Proximamente from './pages/admin/Proximamente'

export default function App() {
  return (
    <ProveedorSesion>
      <Rutas />
    </ProveedorSesion>
  )
}

function Rutas() {
  const { path } = useRuta()
  if (path.startsWith('/admin')) return <RutasAdmin path={path} />
  switch (path) {
    case '/': return <Inicio />
    case '/catalogo': return <Catalogo />
    case '/acerca-de': return <AcercaDe />
    case '/agendar': return <AgendarCita />
    default: return <Inicio />
  }
}

function RutasAdmin({ path }: { path: string }) {
  const { usuario, cargando } = useSesion()
  if (cargando) return <div className={fondoLogin}><Cargando /></div>
  if (!usuario) return <Login />
  if (path.startsWith('/admin/productos')) return <Productos />
  switch (path) {
    case '/admin/citas': return <Citas />
    case '/admin/paquetes': return <Proximamente titulo="Paquetes" />
    case '/admin/resenas': return <Proximamente titulo="Reseñas" />
    case '/admin/configuracion': return <Proximamente titulo="Configuracion" />
    default: return <Panel />
  }
}
