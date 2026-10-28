import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import { api, etiquetaServicio, formatoFecha, type Cita, type EstadoCita } from '../../lib/api'
import { celdaTd, celdaTh, tabla, tarjetaAdmin } from '../../lib/estilos'
import { useDatos } from '../../lib/useDatos'

const FILTROS: { valor: EstadoCita | null; texto: string }[] = [
  { valor: null, texto: 'Todos' },
  { valor: 'proximo', texto: 'Proximos' },
  { valor: 'cancelado', texto: 'Cancelados' },
  { valor: 'en proceso', texto: 'En proceso' },
  { valor: 'terminado', texto: 'Terminados' },
]
const ESTADOS: EstadoCita[] = ['proximo', 'en proceso', 'terminado', 'cancelado']

const COLOR_ESTADO: Record<EstadoCita, string> = {
  proximo: 'text-black',
  cancelado: 'text-error',
  terminado: 'text-exito',
  'en proceso': 'text-dorado',
}
const chip = 'rounded-[15px] bg-chip font-texto whitespace-nowrap text-tinto-texto transition-colors'

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
      <div className="-mt-1 mb-[26px] flex flex-wrap items-center gap-2">
        <div className="relative h-[38px] w-[300px] max-[960px]:w-auto max-[960px]:flex-1">
          <svg className="absolute top-[11px] left-[13px] text-[#3c3c43]" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="h-full w-full rounded-[19px] bg-white pr-4 pl-9 font-texto text-[15px] leading-none shadow-[0_2px_8px_rgba(48,14,21,0.12)]"
            placeholder="Buscar cita"
            aria-label="Buscar cita por nombre, teléfono o correo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="size-[38px] flex-none rounded-full bg-white font-texto text-[21px] leading-none text-black shadow-[0_2px_8px_rgba(48,14,21,0.12)]"
          aria-label="Limpiar búsqueda" onClick={() => setTexto('')}>×</button>
        <div className="ml-8 flex flex-wrap gap-2.5 max-[1200px]:ml-2 max-[960px]:ml-0 max-[960px]:w-full" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.texto}
              type="button"
              className={`${chip} h-[30px] min-w-[82px] px-3 text-[15px] leading-[30px] aria-pressed:bg-tinto-oscuro aria-pressed:text-white`}
              aria-pressed={estado === f.valor}
              onClick={() => setEstado(f.valor)}
            >
              {f.texto}
            </button>
          ))}
        </div>
      </div>

      <section className={`${tarjetaAdmin} px-7 pt-[26px] pb-[22px]`}>
        <h2 className="font-ui text-[19px] leading-[1.3] font-semibold text-black">
          {tituloTabla === 'Todos' ? 'Todas las citas' : tituloTabla}
          {citas.datos && <span className="text-base text-dorado"> · {citas.datos.length}</span>}
        </h2>
        {errorAccion && <MensajeError texto={errorAccion} />}
        <table className={tabla}>
          <thead>
            <tr>
              {['Fecha de cita', 'Usuario', 'Telefono', 'Servicio', 'Detalles'].map((t) => <th key={t} className={celdaTh}>{t}</th>)}
              <th className={`${celdaTh} w-32`}><span className="sr-only">Estado</span></th>
            </tr>
          </thead>
          <tbody>
            {citas.datos?.map((c) => (
              <tr key={c.id}>
                <td className={celdaTd}>{formatoFecha(c.fecha)}</td>
                <td className={celdaTd}>
                  {c.nombre_cliente}
                  <small className="block text-xs text-texto-secundario">{c.correo}{c.usuario_id && ' · con cuenta'}</small>
                </td>
                <td className={celdaTd}>{c.telefono}</td>
                <td className={celdaTd}>
                  <span className={`${chip} inline-block h-7 min-w-[100px] px-3 text-center text-sm leading-7`}>{etiquetaServicio(c.tipo_servicio)}</span>
                </td>
                <td className={`${celdaTd} text-[13px]! text-texto-secundario`}>
                  {c.productos.length > 0 && <span className="block text-black">{c.productos.map((p) => p.nombre).join(', ')}</span>}
                  {c.detalles ?? (c.productos.length ? null : '—')}
                </td>
                <td className={celdaTd}>
                  <select
                    className={`w-full rounded-[14px] border border-rosa-vino bg-white px-2 py-[5px] font-texto text-[13px] leading-[1.2] capitalize ${COLOR_ESTADO[c.estado]}`}
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
