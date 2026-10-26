import { useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import { api, formatoFecha, type Cita, type Estadisticas, type Producto } from '../../lib/api'
import { useSesion } from '../../lib/auth'
import { Link } from '../../lib/router'
import { celdaTd, celdaTh, enlaceDorado, tabla, tarjetaAdmin, tarjetaCrema, tituloTarjetaAdmin } from '../../lib/estilos'
import { useDatos } from '../../lib/useDatos'

const hoy = () => new Date().toLocaleDateString('en-CA') // AAAA-MM-DD local

const COLOR_TIPO: Record<string, string> = {
  nuevo: 'bg-[#d5e4da] text-exito',
  eliminacion: 'bg-[#f0d6d8] text-error',
}

/* ADMINISTRADOR (Figma 20:150) */
export default function Panel() {
  const { usuario } = useSesion()
  const [verTodo, setVerTodo] = useState(false)
  const stats = useDatos(() => api<Estadisticas>('/estadisticas', { params: { recientes: 20 } }))
  const proximas = useDatos(() => api<Cita[]>('/citas', { params: { estado: 'proximo', desde: hoy(), limit: 3 } }))
  const productos = useDatos(() => api<Producto[]>('/productos', { params: { limit: 500 } }))

  const nombre = usuario?.nombre_completo.split(' ')[0] ?? ''
  const actividad = stats.datos?.actividad_reciente ?? []
  const inventario = conteoInventario(productos.datos ?? [])

  return (
    <AdminLayout titulo={`Bienvenide, ${nombre}`}>
      <div className="mb-5 grid grid-cols-3 gap-4 max-[960px]:grid-cols-1">
        <Stat titulo="Productos en catalogo" valor={stats.datos?.productos_en_catalogo} cargando={stats.cargando} />
        <Stat titulo="Citas proximas" valor={stats.datos?.citas_proximas} cargando={stats.cargando} />
        <Stat titulo="Ventas totales" valor={null} cargando={false} nota="Aún no se registran ventas" />
      </div>
      {stats.error && <MensajeError texto={stats.error} reintentar={stats.recargar} />}

      <section className={`${tarjetaAdmin} px-7 pt-[26px] pb-[22px]`}>
        <h2 className={tituloTarjetaAdmin}>CITAS PROXIMAS</h2>
        <table className={tabla}>
          <thead>
            <tr>{['Fecha de cita', 'Usuario', 'Telefono', 'Correo', 'Detalles'].map((t) => <th key={t} className={celdaTh}>{t}</th>)}</tr>
          </thead>
          <tbody>
            {proximas.datos?.map((c) => (
              <tr key={c.id}>
                <td className={celdaTd}>{formatoFecha(c.fecha)}</td>
                <td className={celdaTd}>{c.nombre_cliente}</td>
                <td className={celdaTd}>{c.telefono}</td>
                <td className={celdaTd}>{c.correo ?? '—'}</td>
                <td className={`${celdaTd} text-[13px]! text-texto-secundario`}>{c.detalles ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {proximas.cargando && <Cargando />}
        {proximas.error && <MensajeError texto={proximas.error} reintentar={proximas.recargar} />}
        {proximas.datos?.length === 0 && <Vacio texto="No hay citas próximas." />}
      </section>

      <div className="grid grid-cols-[843fr_565fr] gap-4 max-[960px]:grid-cols-1">
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

        <section className={`${tarjetaAdmin} flex flex-col py-[22px] pr-7 pl-9`}>
          <h2 className={tituloTarjetaAdmin}>Uso de inventario</h2>
          {productos.cargando && <Cargando />}
          {productos.datos && (
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

function Stat({ titulo, valor, cargando, nota }: { titulo: string; valor: number | null | undefined; cargando: boolean; nota?: string }) {
  return (
    <section className={`${tarjetaCrema} flex h-[140px] flex-col px-6 py-5`}>
      <h2 className="font-ui text-[15px] leading-[1.3] font-semibold text-tinto-texto">{titulo}</h2>
      <p className="mt-auto font-ui text-[46px] leading-none font-bold text-tinto">{cargando ? '…' : valor ?? '—'}</p>
      {nota && <p className="font-texto text-[13px] leading-[1.3] text-texto-secundario">{nota}</p>}
    </section>
  )
}

function conteoInventario(productos: Producto[]) {
  const total = productos.length || 1
  const filas = [
    { etiqueta: 'En stock', n: productos.filter((p) => p.disponibilidad === 'stock').length },
    { etiqueta: 'Bajo pedido', n: productos.filter((p) => p.disponibilidad === 'bajo pedido').length },
    { etiqueta: 'Próximamente', n: productos.filter((p) => p.disponibilidad === 'proximamente').length },
  ]
  return filas.map((f) => ({ ...f, pct: Math.round((f.n / total) * 100) }))
}
