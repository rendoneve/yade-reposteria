import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import heroInicio from '../assets/img/hero-inicio.png'
import logoYade from '../assets/img/logo-yade.png'
import { api, type Negocio } from './api'
import { useRuta } from './router'

// Lo que se muestra mientras carga o si el administrador aún no lo ha llenado
export const NOMBRE_POR_DEFECTO = 'Yade Bakery'
export const HERO_TEXTO_POR_DEFECTO = 'El postre perfecto\nsiempre es una\nBUENA IDEA'

type ContextoNegocio = {
  negocio: Negocio | null
  error: string | null
  cargando: boolean
  recargar: () => void
  actualizar: (n: Negocio) => void
}

const Contexto = createContext<ContextoNegocio | null>(null)

/* Carga /negocio una sola vez para todo el sitio (encabezado, pie, Inicio, Acerca de y el panel). */
export function ProveedorNegocio({ children }: { children: ReactNode }) {
  const { path } = useRuta()
  const debeCargar = !path.startsWith('/admin') || path === '/admin/configuracion'
  const [negocio, setNegocio] = useState<Negocio | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!debeCargar) return
    let vigente = true
    setCargando(true)
    api<Negocio>('/negocio')
      .then((n) => { if (vigente) { setNegocio(n); setError(null) } })
      .catch((e: Error) => { if (vigente) setError(e.message) })
      .finally(() => { if (vigente) setCargando(false) })
    return () => { vigente = false }
  }, [debeCargar, version])

  const recargar = useCallback(() => setVersion((v) => v + 1), [])

  return (
    <Contexto.Provider value={{ negocio, error, cargando, recargar, actualizar: setNegocio }}>
      {children}
    </Contexto.Provider>
  )
}

export function useNegocio() {
  const c = useContext(Contexto)
  if (!c) throw new Error('useNegocio debe usarse dentro de <ProveedorNegocio>')
  const n = c.negocio
  return {
    ...c,
    nombre: n?.nombre || NOMBRE_POR_DEFECTO,
    logo: n?.logo_url || logoYade,
    heroImagen: n?.hero_url || heroInicio,
    heroLineas: (n?.texto_principal || HERO_TEXTO_POR_DEFECTO).split('\n').map((l) => l.trim()).filter(Boolean),
    banner: n?.banner_url ?? null,
  }
}
