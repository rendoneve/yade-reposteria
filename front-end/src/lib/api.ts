/* Cliente de la API: todo pasa por el gateway (http://localhost:8000/api). */
import { marcarViejo } from './cache'

// En desarrollo el gateway corre en localhost; en producción, por defecto, comparte origen.
// Se puede sobrescribir explícitamente con VITE_API_URL en cualquier entorno.
export const API_URL: string = import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:8000/api' : '/api')

const CLAVE_TOKEN = 'yade_token'
const GET_EN_CURSO = new Map<string, Promise<Response>>()

export function leerToken(): string | null {
  try {
    return localStorage.getItem(CLAVE_TOKEN)
  } catch {
    return null
  }
}

export function guardarToken(token: string | null) {
  try {
    if (token) localStorage.setItem(CLAVE_TOKEN, token)
    else localStorage.removeItem(CLAVE_TOKEN)
  } catch {
    /* sin almacenamiento: la sesión dura lo que la pestaña */
  }
}

export class ErrorApi extends Error {
  status: number
  constructor(status: number, mensaje: string) {
    super(mensaje)
    this.status = status
  }
}

type Opciones = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  params?: Record<string, string | number | undefined | null>
}

/* Respuesta con el total de registros (header X-Total-Count), para paginar. */
export type Pagina<T> = { items: T; total: number }

export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  return (await peticion<T>(ruta, opciones)).items
}

/* Igual que api(), pero también devuelve el total que manda el servidor en X-Total-Count. */
export function apiPaginada<T>(ruta: string, opciones: Opciones = {}): Promise<Pagina<T>> {
  return peticion<T>(ruta, opciones)
}

async function peticion<T>(ruta: string, { method = 'GET', body, params }: Opciones = {}): Promise<Pagina<T>> {
  const url = new URL(API_URL + ruta, window.location.origin)
  for (const [k, v] of Object.entries(params ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  const headers: Record<string, string> = {}
  const token = leerToken()
  if (token) headers.Authorization = `Bearer ${token}`
  // Con FormData el navegador pone el Content-Type (multipart con su boundary)
  const esArchivo = body instanceof FormData
  if (body !== undefined && !esArchivo) headers['Content-Type'] = 'application/json'

  let r: Response
  try {
    const opcionesFetch: RequestInit = {
      method,
      headers,
      body: esArchivo ? body : body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    }
    if (method === 'GET') {
      // React StrictMode monta efectos dos veces en desarrollo; compartir el GET evita
      // duplicar llamadas lentas al gateway y también combina cargas simultáneas idénticas.
      const clave = `${url.href}|${token ?? ''}`
      let pendiente = GET_EN_CURSO.get(clave)
      if (!pendiente) {
        pendiente = (async () => {
          for (let intento = 0; ; intento++) {
            const respuesta = await fetch(url, opcionesFetch)
            if (intento < 2 && (respuesta.status === 502 || respuesta.status === 503)) {
              await new Promise((resolve) => setTimeout(resolve, 250 * (intento + 1)))
              continue
            }
            return respuesta
          }
        })()
        GET_EN_CURSO.set(clave, pendiente)
        void pendiente.then(
          () => { if (GET_EN_CURSO.get(clave) === pendiente) GET_EN_CURSO.delete(clave) },
          () => { if (GET_EN_CURSO.get(clave) === pendiente) GET_EN_CURSO.delete(clave) },
        )
      }
      r = await pendiente.then((respuesta) => respuesta.clone())
    } else {
      r = await fetch(url, opcionesFetch)
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'TimeoutError') {
      throw new ErrorApi(0, 'El servidor tardó demasiado en responder. Intenta de nuevo.')
    }
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. ¿Está corriendo el backend?')
  }

  if (r.status === 401 && token) {
    guardarToken(null)
    window.dispatchEvent(new Event('sesion-expirada'))
  }
  // Un cambio guardado puede afectar cualquier lista: todo lo guardado en caché se vuelve a pedir
  if (r.ok && method !== 'GET') marcarViejo()
  const total = Number(r.headers.get('X-Total-Count') ?? NaN)
  if (r.status === 204) return { items: undefined as T, total: 0 }
  const datos = await r.json().catch(() => null)
  if (!r.ok) throw new ErrorApi(r.status, mensajeDeError(datos) ?? `Error ${r.status}`)
  return { items: datos as T, total: Number.isNaN(total) ? (Array.isArray(datos) ? datos.length : 0) : total }
}

function mensajeDeError(datos: unknown): string | null {
  if (!datos || typeof datos !== 'object' || !('detail' in datos)) return null
  const d = (datos as { detail: unknown }).detail
  if (typeof d === 'string') return d
  if (Array.isArray(d) && d.length) {
    // Errores de validación de FastAPI
    return d.map((e: { msg?: string; loc?: unknown[] }) => {
      const msg = (e.msg ?? '').replace(/^Value error, /, '')
      const campo = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : ''
      // Un número es la posición en una lista (no dice nada al usuario)
      return campo && typeof campo !== 'number' ? `${campo}: ${msg}` : msg
    }).join(' · ')
  }
  return null
}

/* ---------- Imágenes ---------- */

export const TIPOS_IMAGEN = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024

/* Reduce la foto en el navegador antes de subirla: las cámaras dan 3-5 MB y en el sitio se
   muestran a 260-600 px. Se convierte a WebP de máximo LADO_MAXIMO px (suele quedar en 100-300 KB).
   Los GIF se dejan igual (perderían la animación) y si el resultado no es más ligero se usa el original. */
const LADO_MAXIMO = 1600

export async function comprimirImagen(archivo: File): Promise<File> {
  if (archivo.type === 'image/gif' || typeof createImageBitmap !== 'function') return archivo
  try {
    const bitmap = await createImageBitmap(archivo)
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(bitmap.width * escala)
    lienzo.height = Math.round(bitmap.height * escala)
    lienzo.getContext('2d')?.drawImage(bitmap, 0, 0, lienzo.width, lienzo.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((listo) => lienzo.toBlob(listo, 'image/webp', 0.85))
    if (!blob || blob.type !== 'image/webp' || blob.size >= archivo.size) return archivo
    return new File([blob], archivo.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' })
  } catch {
    return archivo // el formato no se pudo leer aquí (p. ej. AVIF en un navegador viejo): se sube tal cual
  }
}

/* Sube la imagen al bucket (POST /api/imagenes, servicio-catalogo) y devuelve su URL pública. */
export async function subirImagen(archivo: File): Promise<string> {
  const datos = new FormData()
  datos.append('archivo', await comprimirImagen(archivo))
  const { url } = await api<{ url: string }>('/imagenes', { method: 'POST', body: datos })
  return url
}

/* Cambio que entrega <SubirImagen>: undefined = sin cambios, null = se quitó, File = nueva.
   Devuelve el valor para `imagen_url` (subiendo el archivo si hace falta). */
export type CambioImagen = File | null | undefined

export async function resolverImagen(cambio: CambioImagen, actual: string | null): Promise<string | null> {
  if (cambio === undefined) return actual
  if (cambio === null) return null
  return subirImagen(cambio)
}

/* ---------- Tipos (coinciden con los esquemas del backend) ---------- */

export type Disponibilidad = 'bajo pedido' | 'stock' | 'proximamente'
export type EstadoCita = 'proximo' | 'cancelado' | 'en proceso' | 'terminado'

export type Rol = 'admin' | 'cliente'

export type Usuario = {
  id: number
  nombre_completo: string
  username: string
  correo: string
  telefono: string | null
  rol: Rol
}

export type Categoria = {
  id: number
  nombre: string
  imagen_url: string | null
  cantidad_productos: number
}

export type Etiqueta = { id: number; nombre: string }

export type ProductoOpcion = { id: number; nombre: string; categoria_nombre: string }

export type Producto = {
  id: number
  nombre: string
  descripcion: string
  precio: string
  imagen_url: string | null
  disponibilidad: Disponibilidad
  categoria_id: number
  categoria_nombre: string | null
  etiquetas: string[]
  created_at: string
}

export type Cita = {
  id: number
  fecha: string
  nombre_cliente: string
  telefono: string
  correo: string | null
  detalles: string | null
  tipo_servicio: string // nombre de la categoría
  estado: EstadoCita
  usuario_id: number | null // cliente con cuenta que la agendó
  productos: { producto_id: number; nombre: string }[]
}

export type Resena = {
  id: number
  nombre_cliente: string
  descripcion: string
  fecha: string // YYYY-MM-DD
  productos: { id: number; nombre: string }[]
  cita_id: number | null
  usuario_id: number | null
  aprobada: boolean // false = pendiente de que el administrador la apruebe
  calificacion: number | null // 1 a 5 estrellas
}

export type ResumenResenas = { total: number; con_calificacion: number; promedio: number | null }

export type Horario = { dia_semana: number; dia: string; abre: string | null; cierra: string | null; cerrado: boolean }

export type Negocio = {
  nombre: string | null
  logo_url: string | null
  hero_url: string | null
  banner_url: string | null
  texto_principal: string | null
  catalogo_url: string | null // hero de la página Menú
  texto_catalogo: string | null
  texto_acerca: string | null
  whatsapp: string | null
  ubicacion: string | null
  mapa_url: string | null
  horarios: Horario[]
}

/* Horas que se pueden agendar un día (GET /citas/disponibilidad). */
export type AgendaDia = {
  fecha: string
  configurado: boolean // false: el negocio no ha puesto horarios; se deja escoger cualquier hora
  abierto: boolean
  abre: string | null
  cierra: string | null
  duracion_minutos: number
  franjas: { inicio: string; disponible: boolean }[]
}

export type Actividad = { id: number; fecha: string; persona: string; nombre: string; tipo: string }

export type Estadisticas = {
  productos_en_catalogo: number | null
  inventario: { total: number; stock: number; 'bajo pedido': number; proximamente: number } | null
  citas_proximas: number | null
  citas_terminadas: number | null
  citas_siguientes: CitaPanel[]
  actividad_reciente: Actividad[]
  errores: Record<string, string>
}

export type CitaPanel = Pick<Cita, 'id' | 'fecha' | 'nombre_cliente' | 'telefono' | 'correo' | 'detalles'>

/* ---------- Formatos ---------- */

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
export const formatoPrecio = (p: string | number) => moneda.format(Number(p))

const fechaHora = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
export const formatoFecha = (iso: string) => fechaHora.format(new Date(iso))

const soloFecha = new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' })
// "2026-10-27" sin hora: se lee como fecha local (new Date('2026-10-27') sería UTC y podría salir un día antes)
export const formatoDia = (ymd: string) => {
  const [a, m, d] = ymd.split('-').map(Number)
  return soloFecha.format(new Date(a, m - 1, d))
}

// El tipo de una cita es uno de estos servicios o el nombre de una categoría del catálogo
export const ETIQUETA_SERVICIO: Record<string, string> = {
  especial: 'Especiales',
  individual: 'Individuales',
  pasteles: 'Pasteles',
}
export const etiquetaServicio = (tipo: string) => ETIQUETA_SERVICIO[tipo] ?? tipo

// Las etiquetas se guardan en minúsculas y sin acentos ("mas vendidos"); así se muestran
const NOMBRE_ETIQUETA: Record<string, string> = {
  'mas vendidos': 'Más vendidos',
  'sin azucar': 'Sin azúcar',
}
export const nombreEtiqueta = (nombre: string) =>
  NOMBRE_ETIQUETA[nombre] ?? nombre.charAt(0).toUpperCase() + nombre.slice(1)

export const ETIQUETA_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  'bajo pedido': 'Bajo pedido',
  stock: 'Stock',
  proximamente: 'Próximamente',
}
