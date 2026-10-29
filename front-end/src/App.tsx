import { lazy, Suspense } from 'react'
import Avisos from './components/Avisos'
import { Cargando } from './components/Estado'
import { ProveedorSesion } from './lib/auth'
import { fondoLogin } from './lib/estilos'
import { useNegocio } from './lib/negocio'
import { useRuta, useTitulo } from './lib/router'
import { useSesion } from './lib/sesion'
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
const ResenasAdmin = lazy(() => import('./pages/admin/Resenas'))

// Título de la pestaña por pantalla (null = solo el nombre del negocio)
const TITULOS: [prefijo: string, titulo: string | null][] = [
  ['/admin/productos', 'Productos · Panel'],
  ['/admin/citas', 'Citas · Panel'],
  ['/admin/resenas', 'Reseñas · Panel'],
  ['/admin/configuracion', 'Configuración · Panel'],
  ['/admin', 'Panel'],
  ['/cuenta/citas', 'Mis citas'],
  ['/cuenta/resenas', 'Mis reseñas'],
  ['/cuenta', 'Mi cuenta'],
  ['/catalogo', 'Menú'],
  ['/acerca-de', 'Acerca de'],
  ['/agendar', 'Agendar cita'],
  ['/entrar', 'Entrar'],
  ['/registro', 'Crear cuenta'],
]

export default function App() {
  return (
    <ProveedorSesion>
      <Suspense fallback={<div className={fondoLogin}><Cargando /></div>}>
        <Rutas />
      </Suspense>
      <Avisos />
    </ProveedorSesion>
  )
}

function Rutas() {
  const { path } = useRuta()
  const { nombre } = useNegocio()
  useTitulo(TITULOS.find(([p]) => path.startsWith(p))?.[1] ?? null, nombre)
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
    case '/admin/resenas': return <ResenasAdmin />
    case '/admin/configuracion': return <Configuracion />
    default: return <Panel />
  }
}
