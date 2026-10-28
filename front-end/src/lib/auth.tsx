import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, guardarToken, leerToken, type Usuario } from './api'

export type DatosRegistro = {
  nombre_completo: string
  username: string
  correo: string
  password: string
  telefono: string | null
}

type Sesion = {
  usuario: Usuario | null
  cargando: boolean
  entrar: (usuario: string, password: string) => Promise<Usuario>
  registrar: (datos: DatosRegistro) => Promise<Usuario>
  actualizar: (usuario: Usuario) => void
  salir: () => void
}

type RespuestaToken = { access_token: string; usuario: Usuario }

const Contexto = createContext<Sesion | null>(null)

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [cargando, setCargando] = useState(() => leerToken() !== null)

  useEffect(() => {
    if (!leerToken()) return
    api<Usuario>('/auth/me')
      .then(setUsuario)
      .catch(() => guardarToken(null))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    const expirada = () => setUsuario(null)
    window.addEventListener('sesion-expirada', expirada)
    return () => window.removeEventListener('sesion-expirada', expirada)
  }, [])

  const iniciar = useCallback((r: RespuestaToken) => {
    guardarToken(r.access_token)
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
    guardarToken(null)
    setUsuario(null)
  }, [])

  return <Contexto.Provider value={{ usuario, cargando, entrar, registrar, actualizar: setUsuario, salir }}>{children}</Contexto.Provider>
}

export function useSesion() {
  const s = useContext(Contexto)
  if (!s) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>')
  return s
}
