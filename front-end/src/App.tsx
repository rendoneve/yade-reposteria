import { lazy, Suspense, useEffect } from 'react'
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
const NoEncontrada = lazy(() => import('./pages/NoEncontrada'))
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

// Rutas del sitio público (lo demás, fuera de /admin y /cuenta, es 404)
const PUBLICAS = ['/', '/catalogo', '/acerca-de', '/agendar', '/entrar', '/registro']

/* Cuando el navegador está libre, se bajan las páginas públicas: así la transición entre pantallas
   no pasa por "Cargando…" la primera vez que se visita cada una. */
function precargarPaginas() {
  void import('./pages/Inicio')
  void import('./pages/Catalogo')
  void import('./pages/AcercaDe')
  void import('./pages/AgendarCita')
  void import('./pages/cuenta/Entrar')
}

// RAÍZ: sesión global + páginas cargadas bajo demanda (Suspense) + avisos flotantes.
export default function App() {
  useEffect(() => {
    if ('requestIdleCallback' in window) {
      const id = requestIdleCallback(precargarPaginas, { timeout: 4000 })
      return () => cancelIdleCallback(id)
    }
    const id = setTimeout(precargarPaginas, 2000)
    return () => clearTimeout(id)
  }, [])

  return (
    <ProveedorSesion>
      <Suspense fallback={<div className={fondoLogin}><Cargando /></div>}>
        <Rutas />
      </Suspense>
      <Avisos />
    </ProveedorSesion>
  )
}

// ENRUTADOR: decide qué pantalla se muestra según la URL y pone el título de la pestaña.
function Rutas() {
  const { path } = useRuta()
  const { nombre } = useNegocio()
  const existe = PUBLICAS.includes(path) || path.startsWith('/admin') || path.startsWith('/cuenta')
  useTitulo(existe ? (TITULOS.find(([p]) => path.startsWith(p))?.[1] ?? null) : 'Página no encontrada', nombre)
  // /admin/* y /cuenta/* tienen su propia protección; el resto son páginas públicas.
  if (path.startsWith('/admin')) return <RutasAdmin path={path} />
  if (path.startsWith('/cuenta')) return <RutasCuenta path={path} />
  switch (path) {
    case '/': return <Inicio />
    case '/catalogo': return <Catalogo />
    case '/acerca-de': return <AcercaDe />
    case '/agendar': return <AgendarCita />
    case '/entrar': return <Entrar />
    case '/registro': return <Registro />
    default: return <NoEncontrada />
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

// Panel del administrador: sin sesión de admin se muestra el Login del panel; con sesión, la pantalla pedida.
function RutasAdmin({ path }: { path: string }) {
  const { usuario, cargando } = useSesion()
  if (cargando) return <div className={fondoLogin}><Cargando /></div>
  if (!usuario || usuario.rol !== 'admin') return <Login />
  if (path.startsWith('/admin/productos')) return <Productos />
  switch (path) {
    case '/admin/citas': return <Citas />
    case '/admin/resenas': return <ResenasAdmin />
    case '/admin/configuracion': return <Configuracion />
    default: return <Panel />
  }
}
