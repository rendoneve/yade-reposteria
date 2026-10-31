/* Ayudas para editar el texto con grosor (ver components/TextoRico.tsx). */
export const PESOS = [
  { peso: 400, nombre: 'Normal' },
  { peso: 500, nombre: 'Medio' },
  { peso: 600, nombre: 'Seminegrita' },
  { peso: 700, nombre: 'Negrita' },
  { peso: 800, nombre: 'Extranegrita' },
  { peso: 900, nombre: 'Negra' },
] as const

const MARCA = /\{\d{3}\|([^{}]*)\}/g
export const sinFormato = (t: string) => t.replace(MARCA, '$1')

/* Aplica `peso` a lo seleccionado [ini, fin) quitando antes cualquier marca que hubiera dentro. */
export function aplicarPeso(texto: string, ini: number, fin: number, peso: number | null) {
  const antes = texto.slice(0, ini)
  const medio = sinFormato(texto.slice(ini, fin))
  const despues = texto.slice(fin)
  const nuevo = peso ? `{${peso}|${medio}}` : medio
  return { texto: antes + nuevo + despues, ini, fin: ini + nuevo.length }
}
