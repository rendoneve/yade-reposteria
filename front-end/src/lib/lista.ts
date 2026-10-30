import { useSyncExternalStore } from 'react'

/* LISTA PARA COTIZAR: los postres que el visitante va marcando en el catálogo para pedir
   una sola cotización. Se guarda en el navegador (localStorage) y no necesita sesión. */
const CLAVE = 'yade:lista-cotizar'
const MAXIMO = 20 // mismo tope que el formulario de cita

let ids: number[] = leer()
const oyentes = new Set<() => void>()

function leer(): number[] {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE) ?? '[]')
    return Array.isArray(v) ? v.filter((n): n is number => Number.isInteger(n)).slice(0, MAXIMO) : []
  } catch {
    return []
  }
}

function guardar(nuevos: number[]) {
  ids = nuevos
  try {
    localStorage.setItem(CLAVE, JSON.stringify(ids))
  } catch {
    /* sin almacenamiento: la lista dura mientras la pestaña esté abierta */
  }
  oyentes.forEach((f) => f())
}

const suscribir = (f: () => void) => {
  oyentes.add(f)
  return () => { oyentes.delete(f) }
}

export const useLista = () => useSyncExternalStore(suscribir, () => ids)
export const alternarEnLista = (id: number) =>
  guardar(ids.includes(id) ? ids.filter((x) => x !== id) : ids.length < MAXIMO ? [...ids, id] : ids)
export const vaciarLista = () => guardar([])
export const rutaCotizar = (lista: number[]) => `/agendar?productos=${lista.join(',')}`
