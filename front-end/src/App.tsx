import { Cargando } from './components/Estado'
import { ProveedorSesion, useSesion } from './lib/auth'
import { fondoLogin } from './lib/estilos'
import { ProveedorNegocio } from './lib/negocio'
import { useRuta } from './lib/router'
import AcercaDe from './pages/AcercaDe'
import AgendarCita from './pages/AgendarCita'
import Catalogo from './pages/Catalogo'
import Inicio from './pages/Inicio'
import Login from './pages/Login'
import Entrar from './pages/cuenta/Entrar'
import MisCitas from './pages/cuenta/MisCitas'
import MisResenas from './pages/cuenta/MisResenas'
import Perfil from './pages/cuenta/Perfil'
import Registro from './pages/cuenta/Registro'
import Citas from './pages/admin/Citas'
import Configuracion from './pages/admin/Configuracion'
import Panel from './pages/admin/Panel'
import Productos from './pages/admin/Productos'
import Proximamente from './pages/admin/Proximamente'

export default function App() {
  return (
    <ProveedorSesion>
      <ProveedorNegocio>
        <Rutas />
      </ProveedorNegocio>
    </ProveedorSesion>
  )
}

function Rutas() {
  const { path } = useRuta()
  if (path.startsWith('/admin')) return <RutasAdmin path={path} />
  if (path.startsWith('/cuenta')) return <RutasCuenta path={path} />
  switch (path) {
    case '/': return <Inicio />
    case '/catalogo': return <Catalogo />
    case '/acerca-de': return <AcercaDe />
    case '/agendar': return <AgendarCita />
    case '/entrar': return <Entrar />
    case '/registro': return <Registro />
    default: return <Inicio />
  }
}

/* Panel del cliente: sin sesión muestra el inicio de sesión ahí mismo y, al entrar, la página pedida. */
function RutasCuenta({ path }: { path: string }) {
  const { usuario, cargando } = useSesion()
  if (cargando) return <div className={fondoLogin}><Cargando /></div>
  if (!usuario) return <Entrar />
  switch (path) {
    case '/cuenta/citas': return <MisCitas />
    case '/cuenta/resenas': return <MisResenas />
    default: return <Perfil />
  }
}

function RutasAdmin({ path }: { path: string }) {
  const { usuario, cargando } = useSesion()
  if (cargando) return <div className={fondoLogin}><Cargando /></div>
  if (!usuario || usuario.rol !== 'admin') return <Login />
  if (path.startsWith('/admin/productos')) return <Productos />
  switch (path) {
    case '/admin/citas': return <Citas />
    case '/admin/paquetes': return <Proximamente titulo="Paquetes" />
    case '/admin/resenas': return <Proximamente titulo="Reseñas" />
    case '/admin/configuracion': return <Configuracion />
    default: return <Panel />
  }
}
