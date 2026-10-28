import { lazy, Suspense } from 'react'
import { Cargando } from './components/Estado'
import { ProveedorSesion, useSesion } from './lib/auth'
import { fondoLogin } from './lib/estilos'
import { ProveedorNegocio } from './lib/negocio'
import { useRuta } from './lib/router'
const AcercaDe = lazy(() => import('./pages/AcercaDe'))
const AgendarCita = lazy(() => import('./pages/AgendarCita'))
const Catalogo = lazy(() => import('./pages/Catalogo'))
const Inicio = lazy(() => import('./pages/Inicio'))
const Login = lazy(() => import('./pages/Login'))
const Entrar = lazy(() => import('./pages/cuenta/Entrar'))
const MisCitas = lazy(() => import('./pages/cuenta/MisCitas'))
const MisResenas = lazy(() => import('./pages/cuenta/MisResenas'))
const Perfil = lazy(() => import('./pages/cuenta/Perfil'))
const Registro = lazy(() => import('./pages/cuenta/Registro'))
const Citas = lazy(() => import('./pages/admin/Citas'))
const Configuracion = lazy(() => import('./pages/admin/Configuracion'))
const Panel = lazy(() => import('./pages/admin/Panel'))
const Productos = lazy(() => import('./pages/admin/Productos'))
const Proximamente = lazy(() => import('./pages/admin/Proximamente'))

export default function App() {
  return (
    <ProveedorSesion>
      <ProveedorNegocio>
        <Suspense fallback={<div className={fondoLogin}><Cargando /></div>}>
          <Rutas />
        </Suspense>
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
