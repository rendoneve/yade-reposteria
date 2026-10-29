/* Avisos breves ("Producto guardado") que aparecen abajo a la derecha y se quitan solos. */

export type Aviso = { id: number; texto: string; tipo: 'exito' | 'error' }

let avisos: Aviso[] = []
let siguiente = 1
const oyentes = new Set<() => void>()
const emitir = () => oyentes.forEach((f) => f())

export function avisar(texto: string, tipo: Aviso['tipo'] = 'exito') {
  const id = siguiente++
  avisos = [...avisos, { id, texto, tipo }]
  emitir()
  setTimeout(() => quitarAviso(id), tipo === 'error' ? 6000 : 3500)
}

export function quitarAviso(id: number) {
  avisos = avisos.filter((a) => a.id !== id)
  emitir()
}

export const suscribirAvisos = (f: () => void) => { oyentes.add(f); return () => { oyentes.delete(f) } }
export const leerAvisos = () => avisos
