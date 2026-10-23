import { useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import { api, formatoFecha, type Cita, type Estadisticas, type Producto } from '../../lib/api'
import { useSesion } from '../../lib/auth'
import { Link } from '../../lib/router'
import { useDatos } from '../../lib/useDatos'

const hoy = () => new Date().toLocaleDateString('en-CA') // AAAA-MM-DD local

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
      <div className="panel__stats">
        <Stat titulo="Productos en catalogo" valor={stats.datos?.productos_en_catalogo} cargando={stats.cargando} />
        <Stat titulo="Citas proximas" valor={stats.datos?.citas_proximas} cargando={stats.cargando} />
        <Stat titulo="Ventas totales" valor={null} cargando={false} nota="Aún no se registran ventas" />
      </div>
      {stats.error && <MensajeError texto={stats.error} reintentar={stats.recargar} />}

      <section className="tarjeta-admin">
        <h2 className="tarjeta-admin__titulo">CITAS PROXIMAS</h2>
        <table className="tabla">
          <thead>
            <tr><th>Fecha de cita</th><th>Usuario</th><th>Telefono</th><th>Correo</th><th>Detalles</th></tr>
          </thead>
          <tbody>
            {proximas.datos?.map((c) => (
              <tr key={c.id}>
                <td>{formatoFecha(c.fecha)}</td>
                <td>{c.nombre_cliente}</td>
                <td>{c.telefono}</td>
                <td>{c.correo ?? '—'}</td>
                <td className="tabla__detalles">{c.detalles ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {proximas.cargando && <Cargando />}
        {proximas.error && <MensajeError texto={proximas.error} reintentar={proximas.recargar} />}
        {proximas.datos?.length === 0 && <Vacio texto="No hay citas próximas." />}
      </section>

      <div className="panel__fila">
        <section className="tarjeta-admin tarjeta-admin--actividad">
          <div className="tarjeta-admin__cabecera">
            <h2 className="tarjeta-admin__titulo">Actividad Reciente</h2>
            {actividad.length > 3 && (
              <button type="button" className="enlace-dorado" onClick={() => setVerTodo(!verTodo)}>
                {verTodo ? 'Ver menos  ↑' : 'Ver todo  →'}
              </button>
            )}
          </div>
          <ul className="lista-actividad">
            {(verTodo ? actividad : actividad.slice(0, 3)).map((a) => (
              <li key={a.id}>
                <span className={`lista-actividad__tipo lista-actividad__tipo--${a.tipo}`}>{a.tipo}</span>
                <span className="lista-actividad__nombre">{a.nombre}</span>
                <span className="lista-actividad__meta">{a.persona} · {formatoFecha(a.fecha)}</span>
              </li>
            ))}
          </ul>
          {stats.datos && actividad.length === 0 && <Vacio texto="Sin movimientos todavía." />}
        </section>

        <section className="tarjeta-admin tarjeta-admin--inventario">
          <h2 className="tarjeta-admin__titulo">Uso de inventario</h2>
          {productos.cargando && <Cargando />}
          {productos.datos && (
            <ul className="inventario">
              {inventario.map((i) => (
                <li key={i.etiqueta}>
                  <div className="inventario__fila"><span>{i.etiqueta}</span><strong>{i.n}</strong></div>
                  <div className="inventario__barra"><span style={{ width: `${i.pct}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
          <Link to="/admin/productos" className="enlace-dorado">Ir a productos  →</Link>
        </section>
      </div>
    </AdminLayout>
  )
}

function Stat({ titulo, valor, cargando, nota }: { titulo: string; valor: number | null | undefined; cargando: boolean; nota?: string }) {
  return (
    <section className="stat">
      <h2 className="stat__titulo">{titulo}</h2>
      <p className="stat__valor">{cargando ? '…' : valor ?? '—'}</p>
      {nota && <p className="stat__nota">{nota}</p>}
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
