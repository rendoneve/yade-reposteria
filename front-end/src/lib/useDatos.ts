import { useCallback, useEffect, useEffectEvent, useSyncExternalStore } from 'react'
import { cargarEnCache, leerEntrada, suscribir } from './cache'

/* Carga datos de la API con caché compartida (ver lib/cache.ts).

   `clave` identifica los datos: la misma clave en dos pantallas son los mismos datos.
   Debe cambiar cuando cambian los parámetros (p. ej. `productos:categoria:3`).
   Con `clave = null` no se pide nada.

   Devuelve { datos, error, cargando, actualizando, recargar }:
   `cargando` solo es true cuando todavía no hay nada que mostrar. */
export function useDatos<T>(clave: string | null, cargar: () => Promise<T>) {
  const entrada = useSyncExternalStore(suscribir, () => (clave ? leerEntrada(clave) : undefined))
  const pedir = useEffectEvent((forzar: boolean) => {
    if (clave) void cargarEnCache(clave, cargar, forzar)
  })

  useEffect(() => { pedir(false) }, [clave])

  const recargar = useCallback(() => { if (clave) void cargarEnCache(clave, cargar, true) }, [clave, cargar])

  const datos = entrada?.datos === undefined ? null : (entrada.datos as T)
  return {
    datos,
    error: entrada?.error ?? null,
    cargando: clave !== null && datos === null && !entrada?.error,
    actualizando: entrada?.cargando ?? false,
    recargar,
  }
}
