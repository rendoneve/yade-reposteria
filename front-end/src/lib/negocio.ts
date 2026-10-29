import heroInicio from '../assets/img/hero-inicio.webp'
import logoYade from '../assets/img/logo-yade.png'
import { api, type Negocio } from './api'
import { actualizarEnCache } from './cache'
import { useDatos } from './useDatos'

// Lo que se muestra mientras carga o si el administrador aún no lo ha llenado
export const NOMBRE_POR_DEFECTO = 'Yade Bakery'
export const HERO_TEXTO_POR_DEFECTO = 'El postre perfecto\nsiempre es una\nBUENA IDEA'

const CLAVE = 'negocio'
const cargarNegocio = () => api<Negocio>('/negocio')

/* /negocio se usa en todo el sitio (encabezado, pie, Inicio, Acerca de y el panel).
   Con la caché compartida se pide una sola vez y todas las pantallas lo leen al instante. */
export function useNegocio() {
  const { datos: n, error, cargando, recargar } = useDatos(CLAVE, cargarNegocio)
  return {
    negocio: n,
    error,
    cargando,
    recargar,
    actualizar: (nuevo: Negocio) => actualizarEnCache<Negocio>(CLAVE, () => nuevo),
    nombre: n?.nombre || NOMBRE_POR_DEFECTO,
    logo: n?.logo_url || logoYade,
    // Imagen propia del negocio (se muestra a todo lo ancho) o la ilustración del diseño
    heroPropio: n?.hero_url ?? null,
    heroImagen: n?.hero_url || heroInicio,
    heroLineas: (n?.texto_principal || HERO_TEXTO_POR_DEFECTO).split('\n').map((l) => l.trim()).filter(Boolean),
    banner: n?.banner_url ?? null,
  }
}
