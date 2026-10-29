/* Sesión del usuario: el contexto y el hook. El proveedor está en lib/auth.tsx. */
import { createContext, useContext } from 'react'
import type { Usuario } from './api'

export type DatosRegistro = {
  nombre_completo: string
  username: string
  correo: string
  password: string
  telefono: string | null
}

export type Sesion = {
  usuario: Usuario | null
  cargando: boolean
  entrar: (usuario: string, password: string) => Promise<Usuario>
  registrar: (datos: DatosRegistro) => Promise<Usuario>
  actualizar: (usuario: Usuario) => void
  salir: () => void
}

export const ContextoSesion = createContext<Sesion | null>(null)

export function useSesion() {
  const s = useContext(ContextoSesion)
  if (!s) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>')
  return s
}
