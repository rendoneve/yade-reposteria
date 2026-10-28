/* Cliente de la API: todo pasa por el gateway (http://localhost:8000/api). */

export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

const CLAVE_TOKEN = 'yade_token'

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

export async function api<T>(ruta: string, { method = 'GET', body, params }: Opciones = {}): Promise<T> {
  const url = new URL(API_URL + ruta)
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
    r = await fetch(url, { method, headers, body: esArchivo ? body : body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ErrorApi(0, 'No se pudo conectar con el servidor. ¿Está corriendo el backend?')
  }

  if (r.status === 401 && token) {
    guardarToken(null)
    window.dispatchEvent(new Event('sesion-expirada'))
  }
  if (r.status === 204) return undefined as T
  const datos = await r.json().catch(() => null)
  if (!r.ok) throw new ErrorApi(r.status, mensajeDeError(datos) ?? `Error ${r.status}`)
  return datos as T
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

/* Sube la imagen al bucket (POST /api/imagenes, servicio-catalogo) y devuelve su URL pública. */
export async function subirImagen(archivo: File): Promise<string> {
  const datos = new FormData()
  datos.append('archivo', archivo)
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
}

export type Horario = { dia_semana: number; dia: string; abre: string | null; cierra: string | null; cerrado: boolean }

export type Negocio = {
  nombre: string | null
  logo_url: string | null
  hero_url: string | null
  banner_url: string | null
  texto_principal: string | null
  texto_acerca: string | null
  whatsapp: string | null
  ubicacion: string | null
  mapa_url: string | null
  horarios: Horario[]
}

export type Actividad = { id: number; fecha: string; persona: string; nombre: string; tipo: string }

export type Estadisticas = {
  productos_en_catalogo: number | null
  citas_proximas: number | null
  citas_terminadas: number | null
  actividad_reciente: Actividad[]
  errores: Record<string, string>
}

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

export const ETIQUETA_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  'bajo pedido': 'Bajo pedido',
  stock: 'Stock',
  proximamente: 'Próximamente',
}
