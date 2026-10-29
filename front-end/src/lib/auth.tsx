import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { api, ErrorApi, guardarToken, leerToken, type Usuario } from './api'
import { limpiarCache } from './cache'
import { ContextoSesion, type DatosRegistro } from './sesion'

type RespuestaToken = { access_token: string; usuario: Usuario }
const CLAVE_USUARIO = 'yade_usuario'

function leerUsuarioGuardado(): Usuario | null {
  try {
    const texto = localStorage.getItem(CLAVE_USUARIO)
    if (!texto) return null
    const usuario = JSON.parse(texto) as Usuario
    return usuario && typeof usuario.id === 'number' && typeof usuario.rol === 'string' ? usuario : null
  } catch {
    return null
  }
}

function guardarUsuario(usuario: Usuario | null) {
  try {
    if (usuario) localStorage.setItem(CLAVE_USUARIO, JSON.stringify(usuario))
    else localStorage.removeItem(CLAVE_USUARIO)
  } catch {
    // El perfil en caché solo acelera la interfaz; la API siempre valida el token.
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => leerToken() ? leerUsuarioGuardado() : null)
  const [cargando, setCargando] = useState(() => leerToken() !== null && leerUsuarioGuardado() === null)

  useEffect(() => {
    if (!leerToken()) return
    api<Usuario>('/auth/me')
      .then((actual) => { guardarUsuario(actual); setUsuario(actual) })
      .catch((error: Error) => {
        // Una caída temporal del backend no debe cerrar una sesión válida.
        if (error instanceof ErrorApi && error.status === 401) {
          guardarToken(null)
          guardarUsuario(null)
          setUsuario(null)
        }
      })
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    const expirada = () => { guardarUsuario(null); setUsuario(null); limpiarCache() }
    window.addEventListener('sesion-expirada', expirada)
    return () => window.removeEventListener('sesion-expirada', expirada)
  }, [])

  const iniciar = useCallback((r: RespuestaToken) => {
    limpiarCache() // "mis citas" y demás datos son de cada usuario
    guardarToken(r.access_token)
    guardarUsuario(r.usuario)
    setUsuario(r.usuario)
    return r.usuario
  }, [])

  const entrar = useCallback(
    async (u: string, password: string) =>
      iniciar(await api<RespuestaToken>('/auth/login', { method: 'POST', body: { usuario: u, password } })),
    [iniciar],
  )

  // Crea una cuenta de cliente y deja la sesión iniciada
  const registrar = useCallback(
    async (datos: DatosRegistro) => iniciar(await api<RespuestaToken>('/auth/registro', { method: 'POST', body: datos })),
    [iniciar],
  )

  const salir = useCallback(() => {
    limpiarCache()
    guardarToken(null)
    guardarUsuario(null)
    setUsuario(null)
  }, [])

  const actualizar = useCallback((actual: Usuario) => {
    guardarUsuario(actual)
    setUsuario(actual)
  }, [])

  return <ContextoSesion.Provider value={{ usuario, cargando, entrar, registrar, actualizar, salir }}>{children}</ContextoSesion.Provider>
}
