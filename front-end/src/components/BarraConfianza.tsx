import { CalendarCheck, Cake, Clock, Star, type LucideIcon } from 'lucide-react'
import { useDatos } from '../lib/useDatos'
import { cargarResumenResenas, cargarTotalProductos, RESUMEN_RESENAS, TOTAL_PRODUCTOS } from '../lib/datos'
import { estadoHoy, useNegocio } from '../lib/negocio'

type Dato = { icono: LucideIcon; titulo: string; detalle: string; destacado?: boolean }

/* Franja con lo que a un visitante le importa de un vistazo: cómo nos califican, cuánto hay,
   si estamos abiertos y que se puede agendar en línea. Cada dato aparece solo si hay algo real que decir. */
export default function BarraConfianza() {
  const resumen = useDatos(RESUMEN_RESENAS, cargarResumenResenas)
  const total = useDatos(TOTAL_PRODUCTOS, cargarTotalProductos)
  const { negocio } = useNegocio()
  const hoy = estadoHoy(negocio?.horarios)

  const datos: Dato[] = []
  const r = resumen.datos
  if (r && r.promedio !== null && r.con_calificacion > 0) {
    datos.push({
      icono: Star,
      titulo: `${r.promedio.toFixed(1)} de 5`,
      detalle: `${r.total} ${r.total === 1 ? 'reseña' : 'reseñas'} de clientes`,
    })
  } else if (r && r.total > 0) {
    datos.push({ icono: Star, titulo: `${r.total} ${r.total === 1 ? 'reseña' : 'reseñas'}`, detalle: 'de clientes felices' })
  }
  if (total.datos && total.datos.total > 0) {
    datos.push({ icono: Cake, titulo: `${total.datos.total} ${total.datos.total === 1 ? 'postre' : 'postres'}`, detalle: 'en nuestro menú' })
  }
  if (hoy) {
    datos.push({ icono: Clock, titulo: hoy.titulo, detalle: hoy.detalle, destacado: hoy.abierto })
  }
  datos.push({ icono: CalendarCheck, titulo: 'Agenda en línea', detalle: 'Reserva tu cita en minutos' })

  return (
    <section className="bg-tinto text-beige" aria-label="De un vistazo">
      <ul className="mx-auto grid max-w-[1440px] grid-cols-4 gap-x-6 gap-y-5 px-margen py-7 max-[1000px]:grid-cols-2 max-[560px]:grid-cols-1 max-[760px]:px-6">
        {datos.map(({ icono: Icono, titulo, detalle, destacado }) => (
          <li key={titulo} className="flex items-center gap-3.5">
            <span className="grid h-12 w-12 flex-none place-items-center rounded-full bg-beige/10">
              <Icono size={24} aria-hidden="true" className={destacado ? 'text-[#8fd6ae]' : 'text-caramelo'} />
            </span>
            <span className="flex flex-col">
              <span className="font-ui text-[19px] leading-tight font-bold text-white">{titulo}</span>
              <span className="font-texto text-[15px] leading-snug text-beige/80">{detalle}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
