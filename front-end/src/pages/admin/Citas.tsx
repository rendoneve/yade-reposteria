import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import { api, ETIQUETA_SERVICIO, formatoFecha, type Cita, type EstadoCita } from '../../lib/api'
import { useDatos } from '../../lib/useDatos'

const FILTROS: { valor: EstadoCita | null; texto: string }[] = [
  { valor: null, texto: 'Todos' },
  { valor: 'proximo', texto: 'Proximos' },
  { valor: 'cancelado', texto: 'Cancelados' },
  { valor: 'en proceso', texto: 'En proceso' },
  { valor: 'terminado', texto: 'Terminados' },
]
const ESTADOS: EstadoCita[] = ['proximo', 'en proceso', 'terminado', 'cancelado']

/* ADMINISTRADOR citas (Figma 37:306) */
export default function Citas() {
  const [estado, setEstado] = useState<EstadoCita | null>(null)
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [errorAccion, setErrorAccion] = useState<string | null>(null)

  // Espera a que se deje de escribir para buscar
  useEffect(() => {
    const t = setTimeout(() => setQ(texto.trim()), 300)
    return () => clearTimeout(t)
  }, [texto])

  const citas = useDatos(() => api<Cita[]>('/citas', { params: { estado, q, limit: 200 } }), [estado, q])

  const cambiarEstado = async (c: Cita, nuevo: EstadoCita) => {
    setErrorAccion(null)
    try {
      await api(`/citas/${c.id}/estado`, { method: 'PATCH', body: { estado: nuevo } })
      citas.recargar()
    } catch (e) {
      setErrorAccion((e as Error).message)
    }
  }

  const tituloTabla = FILTROS.find((f) => f.valor === estado)?.texto ?? 'Todos'

  return (
    <AdminLayout titulo="Citas">
      <div className="citas__herramientas">
        <div className="buscador">
          <svg className="buscador__lupa" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            placeholder="Buscar cita"
            aria-label="Buscar cita por nombre, teléfono o correo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <button type="button" className="buscador__limpiar" aria-label="Limpiar búsqueda" onClick={() => setTexto('')}>×</button>
        <div className="chips" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.texto}
              type="button"
              className="chip"
              aria-pressed={estado === f.valor}
              onClick={() => setEstado(f.valor)}
            >
              {f.texto}
            </button>
          ))}
        </div>
      </div>

      <section className="tarjeta-admin">
        <h2 className="tarjeta-admin__titulo tarjeta-admin__titulo--negro">
          {tituloTabla === 'Todos' ? 'Todas las citas' : tituloTabla}
          {citas.datos && <span className="tarjeta-admin__conteo"> · {citas.datos.length}</span>}
        </h2>
        {errorAccion && <MensajeError texto={errorAccion} />}
        <table className="tabla tabla--citas">
          <thead>
            <tr><th>Fecha de cita</th><th>Usuario</th><th>Telefono</th><th>Servicio</th><th>Detalles</th><th><span className="sr-only">Estado</span></th></tr>
          </thead>
          <tbody>
            {citas.datos?.map((c) => (
              <tr key={c.id}>
                <td>{formatoFecha(c.fecha)}</td>
                <td>{c.nombre_cliente}<small>{c.correo}</small></td>
                <td>{c.telefono}</td>
                <td><span className="chip chip--estatico">{ETIQUETA_SERVICIO[c.tipo_servicio]}</span></td>
                <td className="tabla__detalles">{c.detalles ?? '—'}</td>
                <td>
                  <select
                    className={`selector-estado selector-estado--${c.estado.replace(' ', '-')}`}
                    value={c.estado}
                    aria-label={`Estado de la cita de ${c.nombre_cliente}`}
                    onChange={(e) => cambiarEstado(c, e.target.value as EstadoCita)}
                  >
                    {ESTADOS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {citas.cargando && <Cargando />}
        {citas.error && <MensajeError texto={citas.error} reintentar={citas.recargar} />}
        {citas.datos?.length === 0 && <Vacio texto="No hay citas con esos filtros." />}
      </section>
    </AdminLayout>
  )
}
