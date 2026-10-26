/* Clases de Tailwind que se repiten en varias pantallas. */

// ---------- Botones ----------
export const botonPildora =
  'h-8 rounded-2xl bg-tinto-oscuro px-5 font-texto text-[15px] leading-8 text-white transition-colors enabled:hover:bg-tinto disabled:opacity-60'

export const botonOscuro =
  'h-[42px] rounded-2xl bg-tinto-oscuro font-texto text-[17px] leading-none text-white transition-colors enabled:hover:bg-tinto disabled:cursor-wait disabled:opacity-60'

export const botonPeligro =
  'mr-auto h-8 rounded-2xl border border-error px-4 font-texto text-[15px] leading-none text-error transition-colors enabled:hover:bg-error/10 disabled:opacity-60'

// Sin tamaño de letra: cada uso pone el suyo (text-[15px], text-[17px]…)
export const enlaceDorado = 'font-ui leading-[1.3] font-semibold whitespace-pre text-dorado hover:underline'

// ---------- Formularios del panel (modales) ----------
export const formAdmin = 'flex flex-col gap-[13px]'
export const campoAdmin = 'flex flex-col gap-[5px] font-ui text-[13px] leading-[1.2] font-semibold text-tinto-texto'
export const controlAdmin =
  'rounded-lg border border-rosa-vino bg-white px-2.5 py-2 font-texto text-[15px] leading-[1.3] font-normal text-black'
export const filaAdmin = 'grid grid-cols-2 gap-[13px] max-[560px]:grid-cols-1'
export const errorAdmin = 'font-ui text-[13px] leading-[1.4] font-semibold text-error'
export const accionesAdmin = 'mt-1.5 flex justify-end gap-2.5'

// ---------- Formularios públicos ----------
export const campoPublico = 'flex flex-col gap-1.5 font-ui text-sm leading-[1.2] font-semibold text-tinto-texto'
export const controlPublico =
  'rounded-lg border border-rosa-vino bg-white px-3 py-2.5 font-texto text-base leading-[1.3] font-normal text-black'

// ---------- Tarjetas ----------
export const tarjetaCrema = 'rounded-[18px] bg-crema shadow-tarjeta'
export const tarjetaAdmin = `${tarjetaCrema} mb-6 min-h-[340px] max-[960px]:overflow-x-auto max-[960px]:px-3.5 max-[960px]:py-5`
export const tituloTarjetaAdmin = 'font-ui text-[19px] leading-[1.3] font-semibold text-tinto-texto'

// ---------- Tablas del panel ----------
export const tabla = 'mt-3.5 w-full table-fixed border-collapse max-[960px]:min-w-[640px]'
export const celdaTh =
  'border-b-2 border-tinto-texto px-1.5 pb-3.5 text-center font-ui text-[15px] leading-[1.3] font-semibold text-dorado max-[1200px]:text-sm'
export const celdaTd =
  'h-[66px] border-b border-tinto-texto/20 p-1.5 text-center font-texto text-[15px] leading-[1.3] wrap-anywhere max-[1200px]:text-sm'

// ---------- Hero del sitio público ----------
export const hero =
  'relative bg-tinto-oscuro text-beige max-[760px]:h-auto max-[760px]:px-6 max-[760px]:pt-[140px] max-[760px]:pb-8'
export const degradadoHero = 'bg-[linear-gradient(180deg,rgba(155,61,79,0)_-12.4%,#300e15_101.9%)]'
export const heroTitulo =
  'absolute left-margen flex flex-col justify-center font-titulo leading-[48px] font-bold whitespace-nowrap text-beige [font-variant-caps:all-small-caps] max-[760px]:static max-[760px]:h-auto max-[760px]:whitespace-normal'
export const pagina = 'flex min-h-screen flex-col bg-beige'
export const heroLinea = 'block text-[56px] max-[760px]:text-[40px] max-[760px]:leading-none'
export const heroLineaChica = 'block text-[47px] max-[760px]:text-[34px] max-[760px]:leading-none'

// ---------- Login ----------
export const fondoLogin =
  'grid min-h-screen place-items-center bg-tinto-oscuro bg-[linear-gradient(180deg,rgba(155,61,79,0)_0%,#300e15_100%)] p-6'

// ---------- Chips ----------
export const chipFiltro =
  'h-[26px] rounded-[9px] border border-rosa-vino bg-tinto-texto/10 font-texto text-[13px] leading-4 whitespace-nowrap text-black transition-colors aria-pressed:border-tinto aria-pressed:bg-tinto aria-pressed:text-white'
