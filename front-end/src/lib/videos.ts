/* ¿Se puede reproducir solo un video de fondo? No si la persona pidió menos movimiento o ahorra datos. */
export function puedeAutoplay(): boolean {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  const conexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection
  return !conexion?.saveData
}
