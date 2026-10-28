/* Router mínimo con la History API (sin dependencias extra). */
import { useEffect, useState, type AnchorHTMLAttributes, type MouseEvent } from 'react'

const EVENTO = 'cambio-ruta'

export function navegar(ruta: string, reemplazar = false) {
  if (reemplazar) history.replaceState(null, '', ruta)
  else history.pushState(null, '', ruta)
  window.dispatchEvent(new Event(EVENTO))
  window.scrollTo(0, 0)
}

export function useRuta() {
  const leer = () => ({ path: location.pathname, query: new URLSearchParams(location.search) })
  const [ruta, setRuta] = useState(leer)
  useEffect(() => {
    const actualizar = () => setRuta(leer())
    window.addEventListener('popstate', actualizar)
    window.addEventListener(EVENTO, actualizar)
    return () => {
      window.removeEventListener('popstate', actualizar)
      window.removeEventListener(EVENTO, actualizar)
    }
  }, [])
  return ruta
}

/* ?siguiente=/agendar: a dónde volver después de entrar (solo rutas del propio sitio). */
export function rutaSiguiente(query: URLSearchParams): string | null {
  const s = query.get('siguiente')
  return s && s.startsWith('/') && !s.startsWith('//') ? s : null
}

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

export function Link({ to, onClick, ...resto }: LinkProps) {
  const alClic = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    navegar(to)
  }
  return <a href={to} onClick={alClic} {...resto} />
}
