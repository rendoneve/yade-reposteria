import type { ReactNode } from 'react'
import { etiquetaServicio, formatoFecha, type Cita, type EstadoCita } from '../lib/api'
import { chipProducto, tarjetaCrema } from '../lib/estilos'

const ESTADO: Record<EstadoCita, { texto: string; clase: string }> = {
  proximo: { texto: 'Próxima', clase: 'bg-chip text-tinto-texto' },
  'en proceso': { texto: 'En proceso', clase: 'bg-dorado/15 text-dorado' },
  terminado: { texto: 'Terminada', clase: 'bg-exito/15 text-exito' },
  cancelado: { texto: 'Cancelada', clase: 'bg-error/10 text-error' },
}

/* Resumen de una cita del cliente (fecha, estado, servicio y productos). `children` va al pie: acciones o formularios. */
export default function TarjetaCita({ cita, children }: { cita: Cita; children?: ReactNode }) {
  const estado = ESTADO[cita.estado]
  return (
    <article className={`${tarjetaCrema} flex flex-col gap-2.5 px-7 py-5 max-[560px]:px-5`}>
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <h3 className="font-titulo text-[26px] leading-[1.1] font-bold text-tinto-texto">{formatoFecha(cita.fecha)}</h3>
        <span className={`rounded-[13px] px-3 py-1 font-ui text-[13px] leading-none font-semibold ${estado.clase}`}>{estado.texto}</span>
      </div>
      <p className="font-texto text-[15px] text-texto-secundario">
        Servicio: <span className="text-black">{etiquetaServicio(cita.tipo_servicio)}</span>
      </p>
      {cita.productos.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Productos">
          {cita.productos.map((p) => <li key={p.producto_id} className={chipProducto}>{p.nombre}</li>)}
        </ul>
      )}
      {cita.detalles && <p className="font-texto text-[15px] leading-[1.4] whitespace-pre-line">{cita.detalles}</p>}
      {children}
    </article>
  )
}
