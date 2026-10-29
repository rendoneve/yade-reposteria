/* Router mínimo con la History API (sin dependencias extra). El enlace está en components/Link.tsx. */
import { useEffect, useState } from 'react'

const EVENTO = 'cambio-ruta'

export function navegar(ruta: string, reemplazar = false) {
  if (reemplazar) history.replaceState(null, '', ruta)
  else history.pushState(null, '', ruta)
  window.dispatchEvent(new Event(EVENTO))
  if (!reemplazar) window.scrollTo(0, 0) // al cambiar un filtro (?categoria=) no se brinca hasta arriba
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

/* Título de la pestaña (y de los resultados de Google) para cada pantalla. */
export function useTitulo(titulo: string | null, nombreNegocio: string) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${nombreNegocio}` : nombreNegocio
  }, [titulo, nombreNegocio])
}
