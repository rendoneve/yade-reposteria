import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, guardarToken, leerToken, type Usuario } from './api'

type Sesion = {
  usuario: Usuario | null
  cargando: boolean
  entrar: (usuario: string, password: string) => Promise<void>
  salir: () => void
}

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

  const entrar = useCallback(async (u: string, password: string) => {
    const r = await api<{ access_token: string; usuario: Usuario }>('/auth/login', {
      method: 'POST',
      body: { usuario: u, password },
    })
    guardarToken(r.access_token)
    setUsuario(r.usuario)
  }, [])

  const salir = useCallback(() => {
    guardarToken(null)
    setUsuario(null)
  }, [])

  return <Contexto.Provider value={{ usuario, cargando, entrar, salir }}>{children}</Contexto.Provider>
}

export function useSesion() {
  const s = useContext(Contexto)
  if (!s) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>')
  return s
}
