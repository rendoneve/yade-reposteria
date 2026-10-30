import heroCatalogo from '../assets/img/hero-catalogo.webp'
import heroInicio from '../assets/img/hero-inicio.webp'
import logoYade from '../assets/img/logo-yade.png'
import { api, type Horario, type Negocio } from './api'
import { actualizarEnCache } from './cache'
import { useDatos } from './useDatos'

// Lo que se muestra mientras carga o si el administrador aún no lo ha llenado
export const NOMBRE_POR_DEFECTO = 'Yade Bakery'
export const HERO_TEXTO_POR_DEFECTO = 'El postre perfecto\nsiempre es una\nBUENA IDEA'
export const CATALOGO_TEXTO_POR_DEFECTO = 'Postres que hacen\nla vida más dulce'

const lineas = (texto: string) => texto.split('\n').map((l) => l.trim()).filter(Boolean)

const CLAVE = 'negocio'
const CLAVE_LOCAL = 'yade_negocio'

/* Lo último que llegó de /negocio se guarda en el navegador: en la siguiente visita el hero, el nombre
   y los horarios salen bien desde el primer momento (antes se veían los del diseño y luego cambiaban). */
function leerGuardado(): Negocio | null {
  try {
    const texto = localStorage.getItem(CLAVE_LOCAL)
    const n = texto ? (JSON.parse(texto) as Negocio) : null
    return n && typeof n === 'object' && Array.isArray(n.horarios) ? n : null
  } catch {
    return null
  }
}

let ultimo = leerGuardado()

function guardar(n: Negocio) {
  ultimo = n
  try {
    localStorage.setItem(CLAVE_LOCAL, JSON.stringify(n))
  } catch {
    // Sin almacenamiento solo se pierde el arranque rápido
  }
}

const cargarNegocio = () => api<Negocio>('/negocio').then((n) => { guardar(n); return n })

/* /negocio se usa en todo el sitio (encabezado, pie, Inicio, Acerca de y el panel).
   Con la caché compartida se pide una sola vez y todas las pantallas lo leen al instante. */
export function useNegocio() {
  const { datos, error, cargando, recargar } = useDatos(CLAVE, cargarNegocio)
  // Mientras llega la respuesta (o si falla) se usa lo guardado de la visita anterior
  const n = datos ?? ultimo
  return {
    negocio: n,
    error,
    // true solo en la primera visita, cuando todavía no hay nada que mostrar
    cargando: cargando && !n,
    recargar,
    actualizar: (nuevo: Negocio) => { guardar(nuevo); actualizarEnCache<Negocio>(CLAVE, () => nuevo) },
    nombre: n?.nombre || NOMBRE_POR_DEFECTO,
    logo: n?.logo_url || logoYade,
    // Imagen propia del negocio (se muestra a todo lo ancho) o la ilustración del diseño
    heroPropio: n?.hero_url ?? null,
    heroImagen: n?.hero_url || heroInicio,
    heroLineas: lineas(n?.texto_principal || HERO_TEXTO_POR_DEFECTO),
    // Hero de la página Menú (catálogo): igual que el de Inicio
    catalogoPropio: n?.catalogo_url ?? null,
    catalogoImagen: n?.catalogo_url || heroCatalogo,
    catalogoLineas: lineas(n?.texto_catalogo || CATALOGO_TEXTO_POR_DEFECTO),
    banner: n?.banner_url ?? null,
  }
}

/* ¿Está abierto ahora? Se calcula con la hora de Sinaloa (donde está el negocio), no la del visitante. */
const ZONA_NEGOCIO = 'America/Mazatlan'
const DIAS_CORTOS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const formatoZona = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_NEGOCIO, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
})

const aMinutos = (hora: string) => {
  const [h, m] = hora.split(':').map(Number)
  return h * 60 + m
}
const textoHora = (hora: string) => {
  const [h, m] = hora.split(':').map(Number)
  const sufijo = h >= 12 ? 'pm' : 'am'
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${sufijo}`
}

export type EstadoHoy = { abierto: boolean; titulo: string; detalle: string } | null

export function estadoHoy(horarios: Horario[] | undefined, ahora = new Date()): EstadoHoy {
  // Un negocio sin horarios configurados (todos cerrados) no muestra nada, en vez de "cerrado" siempre
  if (!horarios || horarios.every((h) => h.cerrado || !h.abre || !h.cierra)) return null
  const partes = Object.fromEntries(formatoZona.formatToParts(ahora).map((p) => [p.type, p.value]))
  const dia = DIAS_CORTOS.indexOf(partes.weekday)
  const minutos = Number(partes.hour) * 60 + Number(partes.minute)
  const hoy = horarios.find((h) => h.dia_semana === dia)
  if (hoy && !hoy.cerrado && hoy.abre && hoy.cierra) {
    const abre = aMinutos(hoy.abre)
    const cierra = aMinutos(hoy.cierra)
    if (minutos >= abre && minutos < cierra) {
      return { abierto: true, titulo: 'Abierto ahora', detalle: `Hoy hasta las ${textoHora(hoy.cierra)}` }
    }
    if (minutos < abre) {
      return { abierto: false, titulo: 'Abrimos hoy', detalle: `A las ${textoHora(hoy.abre)}` }
    }
  }
  // Ya cerró o hoy no abre: busca el siguiente día con horario
  for (let i = 1; i <= 7; i++) {
    const h = horarios.find((x) => x.dia_semana === (dia + i) % 7)
    if (h && !h.cerrado && h.abre) {
      return {
        abierto: false,
        titulo: 'Cerrado por ahora',
        detalle: `${i === 1 ? 'Mañana' : h.dia} abrimos a las ${textoHora(h.abre)}`,
      }
    }
  }
  return null
}
