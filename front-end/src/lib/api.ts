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
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  let r: Response
  try {
    r = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
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
      const campo = Array.isArray(e.loc) ? e.loc[e.loc.length - 1] : ''
      return campo ? `${campo}: ${e.msg}` : e.msg
    }).join(' · ')
  }
  return null
}

/* ---------- Tipos (coinciden con los esquemas del backend) ---------- */

export type Disponibilidad = 'bajo pedido' | 'stock' | 'proximamente'
export type TipoServicio = 'especial' | 'individual' | 'pasteles'
export type EstadoCita = 'proximo' | 'cancelado' | 'en proceso' | 'terminado'

export type Usuario = {
  id: number
  nombre_completo: string
  username: string
  correo: string
  telefono: string | null
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
  tipo_servicio: TipoServicio
  estado: EstadoCita
}

export type Actividad = { id: number; fecha: string; persona: string; nombre: string; tipo: string }

export type Estadisticas = {
  productos_en_catalogo: number | null
  citas_proximas: number | null
  actividad_reciente: Actividad[]
  errores: Record<string, string>
}

/* ---------- Formatos ---------- */

const moneda = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })
export const formatoPrecio = (p: string | number) => moneda.format(Number(p))

const fechaHora = new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' })
export const formatoFecha = (iso: string) => fechaHora.format(new Date(iso))

export const ETIQUETA_SERVICIO: Record<TipoServicio, string> = {
  especial: 'Especiales',
  individual: 'Individuales',
  pasteles: 'Pasteles',
}

export const ETIQUETA_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  'bajo pedido': 'Bajo pedido',
  stock: 'Stock',
  proximamente: 'Próximamente',
}
