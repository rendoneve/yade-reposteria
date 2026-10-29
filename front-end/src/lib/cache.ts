/* Caché de datos de la API compartida por todas las pantallas.

   - Lo que ya se cargó se muestra al instante al volver a una pantalla (sin "Cargando…").
   - Si tiene más de FRESCO_MS, se vuelve a pedir en segundo plano y se actualiza solo.
   - Dos componentes que piden la misma clave a la vez comparten una sola petición.
   - Cualquier cambio (POST/PATCH/PUT/DELETE) marca todo como viejo; al cambiar de sesión se borra. */

const FRESCO_MS = 30_000

export type Entrada = {
  datos?: unknown
  error?: string
  cargando: boolean
  t: number // cuándo llegaron los datos (0 = hay que volver a pedirlos)
  promesa?: Promise<void>
}

const entradas = new Map<string, Entrada>()
const oyentes = new Set<() => void>()

function poner(clave: string, cambio: Partial<Entrada>) {
  entradas.set(clave, { cargando: false, t: 0, ...entradas.get(clave), ...cambio })
  oyentes.forEach((avisar) => avisar())
}

export function suscribir(avisar: () => void) {
  oyentes.add(avisar)
  return () => { oyentes.delete(avisar) }
}

export const leerEntrada = (clave: string) => entradas.get(clave)

/* Pide los datos si no están o ya son viejos (o siempre, con forzar). */
export function cargarEnCache<T>(clave: string, cargar: () => Promise<T>, forzar = false): Promise<void> {
  const actual = entradas.get(clave)
  if (actual?.promesa) return actual.promesa
  if (!forzar && actual?.datos !== undefined && Date.now() - actual.t < FRESCO_MS) return Promise.resolve()
  const promesa = cargar().then(
    (datos) => poner(clave, { datos, error: undefined, cargando: false, t: Date.now(), promesa: undefined }),
    (e: Error) => poner(clave, { error: e.message, cargando: false, promesa: undefined }),
  )
  poner(clave, { cargando: true, promesa, error: undefined })
  return promesa
}

/* Para el hover de un enlace: deja lista la pantalla siguiente. */
export const precargar = <T,>(clave: string, cargar: () => Promise<T>) => { void cargarEnCache(clave, cargar) }

/* Ajusta los datos guardados sin volver a pedirlos (p. ej. tras cambiar el estado de una cita). */
export function actualizarEnCache<T>(clave: string, cambiar: (datos: T) => T) {
  const actual = entradas.get(clave)
  if (actual?.datos !== undefined) poner(clave, { datos: cambiar(actual.datos as T) })
}

export function marcarViejo() {
  for (const [clave, e] of entradas) entradas.set(clave, { ...e, t: 0 })
}

export function limpiarCache() {
  entradas.clear()
  oyentes.forEach((avisar) => avisar())
}
