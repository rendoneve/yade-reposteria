import { useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import { api, formatoFecha, type Estadisticas } from '../../lib/api'
import { useSesion } from '../../lib/sesion'
import Link from '../../components/Link'
import { celdaTd, celdaTh, enlaceDorado, tabla, tarjetaAdmin, tarjetaCrema, tituloTarjetaAdmin } from '../../lib/estilos'
import { useDatos } from '../../lib/useDatos'

const COLOR_TIPO: Record<string, string> = {
  nuevo: 'bg-[#d5e4da] text-exito',
  eliminacion: 'bg-[#f0d6d8] text-error',
}

const cargarEstadisticas = () => api<Estadisticas>('/estadisticas', { params: { recientes: 20 } })

/* ADMINISTRADOR (Figma 20:150) */
export default function Panel() {
  const { usuario } = useSesion()
  const [verTodo, setVerTodo] = useState(false)
  const stats = useDatos('estadisticas', cargarEstadisticas)

  const nombre = usuario?.nombre_completo.split(' ')[0] ?? ''
  const actividad = stats.datos?.actividad_reciente ?? []
  const inventario = conteoInventario(stats.datos?.inventario ?? null)

  return (
    // PANEL DE INICIO DEL ADMIN: resumen del negocio con datos de /estadisticas (agrega varios servicios).
    <AdminLayout titulo={`Bienvenide, ${nombre}`}>
      {/* ÁREA 1 · TARJETAS DE CIFRAS: productos en catálogo, citas próximas y citas terminadas. */}
      <div className="mb-5 grid grid-cols-3 gap-4 max-[960px]:grid-cols-1">
        <Stat titulo="Productos en catálogo" valor={stats.datos?.productos_en_catalogo} cargando={stats.cargando} />
        <Stat titulo="Citas próximas" valor={stats.datos?.citas_proximas} cargando={stats.cargando} />
        <Stat titulo="Citas terminadas" valor={stats.datos?.citas_terminadas} cargando={stats.cargando} />
      </div>
      {/* Errores: del endpoint completo o de algún servicio en particular (el resto del panel sigue funcionando). */}
      {stats.error && <MensajeError texto={stats.error} reintentar={stats.recargar} />}
      {stats.datos && Object.entries(stats.datos.errores).map(([servicio, mensaje]) => (
        <MensajeError key={servicio} texto={`${servicio}: ${mensaje}`} />
      ))}

      {/* ÁREA 2 · CITAS PRÓXIMAS: tabla con las siguientes citas (teléfono con enlace para llamar) y acceso a "Ver todas". */}
      <section className={`${tarjetaAdmin} px-7 pt-[26px] pb-[22px]`}>
        <div className="flex items-baseline justify-between gap-4">
          <h2 className={tituloTarjetaAdmin}>CITAS PRÓXIMAS</h2>
          <Link to="/admin/citas" className={`${enlaceDorado} text-[17px]`}>Ver todas  →</Link>
        </div>
        <table className={tabla}>
          <thead>
            <tr>{['Fecha de cita', 'Cliente', 'Teléfono', 'Correo', 'Detalles'].map((t) => <th key={t} className={celdaTh}>{t}</th>)}</tr>
          </thead>
          <tbody>
            {stats.datos?.citas_siguientes.map((c) => (
              <tr key={c.id}>
                <td className={celdaTd}>{formatoFecha(c.fecha)}</td>
                <td className={celdaTd}>{c.nombre_cliente}</td>
                <td className={celdaTd}><a className="hover:underline" href={`tel:${c.telefono.replace(/[^\d+]/g, '')}`}>{c.telefono}</a></td>
                <td className={celdaTd}>{c.correo ?? '—'}</td>
                <td className={`${celdaTd} text-[13px]! text-texto-secundario`}>{c.detalles ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {stats.cargando && <Cargando />}
        {stats.datos?.citas_siguientes.length === 0 && <Vacio texto="No hay citas próximas." />}
      </section>

      {/* ÁREAS 3 y 4 · dos tarjetas lado a lado (apiladas en celular). */}
      <div className="grid grid-cols-[843fr_565fr] gap-4 max-[960px]:grid-cols-1">
        {/* ÁREA 3 · ACTIVIDAD RECIENTE: últimos movimientos (citas, productos, reseñas) de servicio-actividad. */}
        <section className={`${tarjetaAdmin} pt-[22px] pr-[26px] pb-[22px] pl-[22px]`}>
          <div className="flex items-baseline justify-between">
            <h2 className={tituloTarjetaAdmin}>Actividad Reciente</h2>
            {actividad.length > 3 && (
              <button type="button" className={`${enlaceDorado} text-[17px]`} onClick={() => setVerTodo(!verTodo)}>
                {verTodo ? 'Ver menos  ↑' : 'Ver todo  →'}
              </button>
            )}
          </div>
          <ul className="mt-4 border-t-2 border-tinto-texto">
            {(verTodo ? actividad : actividad.slice(0, 3)).map((a) => (
              <li
                key={a.id}
                className="grid min-h-[66px] grid-cols-[auto_1fr] grid-rows-[auto_auto] content-center gap-x-3 gap-y-0.5 border-b border-tinto-texto/20 px-1 py-2"
              >
                <span className={`row-span-2 self-center rounded-[14px] px-[11px] py-[5px] font-texto text-xs leading-none capitalize ${COLOR_TIPO[a.tipo] ?? 'bg-chip text-tinto-texto'}`}>
                  {a.tipo}
                </span>
                <span className="font-ui text-sm leading-[1.3] font-semibold text-tinto-texto">{a.nombre}</span>
                <span className="font-texto text-xs leading-[1.2] text-texto-secundario">{a.persona} · {formatoFecha(a.fecha)}</span>
              </li>
            ))}
          </ul>
          {stats.datos && actividad.length === 0 && <Vacio texto="Sin movimientos todavía." />}
        </section>

        {/* ÁREA 4 · USO DE INVENTARIO: barras con cuántos productos hay en stock, bajo pedido y próximamente. */}
        <section className={`${tarjetaAdmin} flex flex-col py-[22px] pr-7 pl-9`}>
          <h2 className={tituloTarjetaAdmin}>Uso de inventario</h2>
          {stats.cargando && <Cargando />}
          {stats.datos?.inventario && (
            <ul className="mt-[22px] mb-[18px] flex flex-col gap-[18px]">
              {inventario.map((i) => (
                <li key={i.etiqueta}>
                  <div className="mb-[7px] flex justify-between font-ui text-sm leading-[1.2] font-semibold text-tinto-texto">
                    <span>{i.etiqueta}</span><strong>{i.n}</strong>
                  </div>
                  <div className="h-[9px] overflow-hidden rounded-md bg-chip">
                    <span className="block h-full rounded-md bg-tinto" style={{ width: `${i.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/productos" className={`${enlaceDorado} mt-auto self-start text-[15px]`}>Ir a productos  →</Link>
        </section>
      </div>
    </AdminLayout>
  )
}

// Tarjeta de una cifra (muestra "…" mientras carga).
function Stat({ titulo, valor, cargando }: { titulo: string; valor: number | null | undefined; cargando: boolean }) {
  return (
    <section className={`${tarjetaCrema} flex h-[140px] flex-col px-6 py-5`}>
      <h2 className="font-ui text-[15px] leading-[1.3] font-semibold text-tinto-texto">{titulo}</h2>
      <p className="mt-auto font-ui text-[46px] leading-none font-bold text-tinto">{cargando ? '…' : valor ?? '—'}</p>
    </section>
  )
}

// Convierte los totales del backend en las filas de las barras de inventario.
function conteoInventario(productos: { total: number; stock: number; 'bajo pedido': number; proximamente: number } | null) {
  const total = productos?.total || 1
  const filas = [
    { etiqueta: 'En stock', n: productos?.stock ?? 0 },
    { etiqueta: 'Bajo pedido', n: productos?.['bajo pedido'] ?? 0 },
    { etiqueta: 'Próximamente', n: productos?.proximamente ?? 0 },
  ]
  return filas.map((f) => ({ ...f, pct: Math.round((f.n / total) * 100) }))
}
