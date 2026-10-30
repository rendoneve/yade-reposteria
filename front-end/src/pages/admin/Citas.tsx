import { MessageCircle, Phone } from 'lucide-react'
import { useEffect, useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import Confirmar from '../../components/Confirmar'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import { api, apiPaginada, etiquetaServicio, formatoFecha, type Cita, type EstadoCita, type Pagina } from '../../lib/api'
import { avisar } from '../../lib/avisos'
import { actualizarEnCache } from '../../lib/cache'
import { celdaTd, celdaTh, enlaceDorado, tabla, tarjetaAdmin, tarjetaCrema } from '../../lib/estilos'
import { useDatos } from '../../lib/useDatos'

const POR_PAGINA = 25

const FILTROS: { valor: EstadoCita | null; texto: string }[] = [
  { valor: null, texto: 'Todas' },
  { valor: 'proximo', texto: 'Próximas' },
  { valor: 'en proceso', texto: 'En proceso' },
  { valor: 'terminado', texto: 'Terminadas' },
  { valor: 'cancelado', texto: 'Canceladas' },
]
const ESTADOS: EstadoCita[] = ['proximo', 'en proceso', 'terminado', 'cancelado']
const TEXTO_ESTADO: Record<EstadoCita, string> = {
  proximo: 'Próxima',
  'en proceso': 'En proceso',
  terminado: 'Terminada',
  cancelado: 'Cancelada',
}

const COLOR_ESTADO: Record<EstadoCita, string> = {
  proximo: 'text-black',
  cancelado: 'text-error',
  terminado: 'text-exito',
  'en proceso': 'text-dorado-texto',
}
const chip = 'rounded-[15px] bg-chip font-texto whitespace-nowrap text-tinto-texto transition-colors'
const controlFecha = 'h-[38px] rounded-[19px] bg-white px-3 font-texto text-[15px] shadow-[0_2px_8px_rgba(48,14,21,0.12)]'

// Utilidades de contacto: dejan solo dígitos para armar enlaces tel: y wa.me.
const telefonoLimpio = (t: string) => t.replace(/[^\d+]/g, '')
// WhatsApp necesita lada de país; los números de 10 dígitos se toman como de México
const whatsappDe = (t: string) => {
  const d = t.replace(/\D/g, '')
  return d.length === 10 ? `52${d}` : d
}
// Fecha de hoy en formato YYYY-MM-DD (para el botón "Hoy").
const hoy = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD local

/* ADMINISTRADOR citas (Figma 37:306) */
export default function Citas() {
  const [estado, setEstado] = useState<EstadoCita | null>(null)
  const [texto, setTexto] = useState('')
  const [q, setQ] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [pagina, setPagina] = useState(0)
  const [cancelando, setCancelando] = useState<Cita | null>(null)

  // Espera a que se deje de escribir para buscar
  useEffect(() => {
    const t = setTimeout(() => { setQ(texto.trim()); setPagina(0) }, 300)
    return () => clearTimeout(t)
  }, [texto])

  const clave = `citas:${estado}:${q}:${desde}:${hasta}:${pagina}`
  const citas = useDatos(clave, () =>
    apiPaginada<Cita[]>('/citas', {
      params: { estado, q, desde, hasta, limit: POR_PAGINA, offset: pagina * POR_PAGINA },
    }),
  )
  const lista = citas.datos?.items ?? []
  const total = citas.datos?.total ?? 0
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))

  // Cualquier cambio de filtro regresa a la página 1.
  const filtrar = (cambio: () => void) => { cambio(); setPagina(0) }

  /* El cambio se ve al instante; si el servidor lo rechaza se regresa al estado anterior. */
  // Cambia el estado de una cita con actualización inmediata en pantalla; si el servidor falla, revierte y avisa.
  const cambiarEstado = async (c: Cita, nuevo: EstadoCita) => {
    const poner = (e: EstadoCita) =>
      actualizarEnCache<Pagina<Cita[]>>(clave, (p) => ({ ...p, items: p.items.map((x) => (x.id === c.id ? { ...x, estado: e } : x)) }))
    poner(nuevo)
    try {
      await api(`/citas/${c.id}/estado`, { method: 'PATCH', body: { estado: nuevo } })
      avisar(`Cita de ${c.nombre_cliente}: ${TEXTO_ESTADO[nuevo].toLowerCase()}`)
    } catch (e) {
      poner(c.estado)
      avisar((e as Error).message, 'error')
    }
  }
  // Cancelar pide confirmación; los demás estados se aplican directo.
  const elegirEstado = (c: Cita, nuevo: EstadoCita) => {
    if (nuevo === c.estado) return
    if (nuevo === 'cancelado') setCancelando(c)
    else void cambiarEstado(c, nuevo)
  }

  // Desplegable de estado de la cita (próximo / en proceso / terminado / cancelado).
  const selectorEstado = (c: Cita) => (
    <select
      className={`w-full rounded-[14px] border border-rosa-vino bg-white px-2 py-[5px] font-texto text-[13px] leading-[1.2] ${COLOR_ESTADO[c.estado]}`}
      value={c.estado}
      aria-label={`Estado de la cita de ${c.nombre_cliente}`}
      onChange={(e) => elegirEstado(c, e.target.value as EstadoCita)}
    >
      {ESTADOS.map((s) => <option key={s} value={s}>{TEXTO_ESTADO[s]}</option>)}
    </select>
  )
  // Teléfono con enlaces para llamar y escribir por WhatsApp.
  const contacto = (c: Cita) => (
    <span className="inline-flex items-center gap-1.5">
      <a className="hover:underline" href={`tel:${telefonoLimpio(c.telefono)}`} title="Llamar">{c.telefono}</a>
      <a
        className="grid size-7 place-items-center rounded-full text-exito hover:bg-exito/10"
        href={`https://wa.me/${whatsappDe(c.telefono)}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`WhatsApp a ${c.nombre_cliente}`}
      >
        <MessageCircle size={17} />
      </a>
    </span>
  )
  // Texto de detalles + productos que pidió el cliente.
  const detalles = (c: Cita) => (
    <>
      {c.productos.length > 0 && <span className="block text-black">{c.productos.map((p) => p.nombre).join(', ')}</span>}
      {c.detalles ?? (c.productos.length ? null : '—')}
    </>
  )

  const tituloTabla = FILTROS.find((f) => f.valor === estado)?.texto ?? 'Todas'

  return (
    // PANTALLA DE CITAS DEL ADMIN.
    <AdminLayout titulo="Citas">
      {/* ÁREA 1 · BARRA DE FILTROS: buscador (nombre, teléfono o correo) y chips de estado. */}
      <div className="-mt-1 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative h-[38px] w-[300px] max-[960px]:w-auto max-[960px]:flex-1">
          <svg className="absolute top-[11px] left-[13px] text-[#3c3c43]" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.4" />
            <path d="M15.5 15.5 21 21" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            className="h-full w-full rounded-[19px] bg-white pr-4 pl-9 font-texto text-[15px] leading-none shadow-[0_2px_8px_rgba(48,14,21,0.12)]"
            placeholder="Buscar por nombre, teléfono o correo"
            aria-label="Buscar cita por nombre, teléfono o correo"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
          />
        </div>
        <div className="ml-8 flex flex-wrap gap-2.5 max-[1200px]:ml-2 max-[960px]:ml-0 max-[960px]:w-full" role="group" aria-label="Filtrar por estado">
          {FILTROS.map((f) => (
            <button
              key={f.texto}
              type="button"
              className={`${chip} h-[30px] min-w-[82px] px-3 text-[15px] leading-[30px] aria-pressed:bg-tinto-oscuro aria-pressed:text-white`}
              aria-pressed={estado === f.valor}
              onClick={() => filtrar(() => setEstado(f.valor))}
            >
              {f.texto}
            </button>
          ))}
        </div>
      </div>
      {/* ÁREA 2 · FILTRO POR FECHAS: desde / hasta, atajo "Hoy" y "Quitar fechas". */}
      <div className="mb-[26px] flex flex-wrap items-center gap-2 font-ui text-sm font-semibold text-tinto-texto">
        <label className="flex items-center gap-2">Desde <input type="date" className={controlFecha} value={desde} onChange={(e) => filtrar(() => setDesde(e.target.value))} /></label>
        <label className="flex items-center gap-2">Hasta <input type="date" className={controlFecha} value={hasta} min={desde || undefined} onChange={(e) => filtrar(() => setHasta(e.target.value))} /></label>
        <button type="button" className={`${chip} h-[30px] px-3 text-[15px]`} onClick={() => filtrar(() => { setDesde(hoy()); setHasta(hoy()) })}>Hoy</button>
        {(desde || hasta) && (
          <button type="button" className={`${enlaceDorado} text-sm`} onClick={() => filtrar(() => { setDesde(''); setHasta('') })}>Quitar fechas</button>
        )}
      </div>

      {/* ÁREA 3 · LISTADO: primero las citas que vienen, luego las pasadas. Tabla en computadora y tarjetas en celular. */}
      <section className={`${tarjetaAdmin} px-7 pt-[26px] pb-[22px] max-[760px]:bg-transparent max-[760px]:px-0 max-[760px]:shadow-none`}>
        <h2 className="font-ui text-[19px] leading-[1.3] font-semibold text-black">
          {tituloTabla === 'Todas' ? 'Todas las citas' : tituloTabla}
          {citas.datos && <span className="text-base text-dorado-texto"> · {total}</span>}
        </h2>
        <p className="mt-1 font-texto text-[13px] text-texto-secundario">Primero las que vienen; después las pasadas, de la más reciente a la más antigua.</p>

        {/* Computadora: tabla */}
        <table className={`${tabla} max-[760px]:hidden`}>
          <thead>
            <tr>
              {['Fecha de cita', 'Cliente', 'Teléfono', 'Servicio', 'Detalles'].map((t) => <th key={t} className={celdaTh}>{t}</th>)}
              <th className={`${celdaTh} w-32`}><span className="sr-only">Estado</span></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((c) => (
              <tr key={c.id}>
                <td className={celdaTd}>{formatoFecha(c.fecha)}</td>
                <td className={celdaTd}>
                  {c.nombre_cliente}
                  <small className="block text-xs text-texto-secundario">{c.correo}{c.usuario_id && ' · con cuenta'}</small>
                </td>
                <td className={celdaTd}>{contacto(c)}</td>
                <td className={celdaTd}>
                  <span className={`${chip} inline-block h-7 min-w-[100px] px-3 text-center text-sm leading-7`}>{etiquetaServicio(c.tipo_servicio)}</span>
                </td>
                <td className={`${celdaTd} text-[13px]! text-texto-secundario`}>{detalles(c)}</td>
                <td className={celdaTd}>{selectorEstado(c)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Celular: una tarjeta por cita */}
        <ul className="mt-3.5 hidden flex-col gap-3 max-[760px]:flex">
          {lista.map((c) => (
            <li key={c.id} className={`${tarjetaCrema} flex flex-col gap-2 px-4 py-3.5`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-ui text-[15px] font-semibold text-tinto-texto">{c.nombre_cliente}</p>
                  <p className="font-texto text-sm text-texto-secundario">{formatoFecha(c.fecha)} · {etiquetaServicio(c.tipo_servicio)}</p>
                </div>
                <div className="w-32 flex-none">{selectorEstado(c)}</div>
              </div>
              <p className="flex items-center gap-1.5 font-texto text-sm"><Phone size={14} aria-hidden="true" />{contacto(c)}</p>
              <p className="font-texto text-[13px] text-texto-secundario">{detalles(c)}</p>
            </li>
          ))}
        </ul>

        {/* Estados de carga, error y vacío. */}
        {citas.cargando && <Cargando />}
        {citas.error && <MensajeError texto={citas.error} reintentar={citas.recargar} />}
        {citas.datos && lista.length === 0 && <Vacio texto="No hay citas con esos filtros." />}

        {/* ÁREA 4 · PAGINACIÓN (25 por página). */}
        {paginas > 1 && (
          <nav className="mt-5 flex items-center justify-center gap-3 font-ui text-sm font-semibold text-tinto-texto" aria-label="Páginas">
            <button type="button" className={`${chip} h-[30px] px-3 disabled:opacity-40`} disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>← Anteriores</button>
            <span>Página {pagina + 1} de {paginas}</span>
            <button type="button" className={`${chip} h-[30px] px-3 disabled:opacity-40`} disabled={pagina + 1 >= paginas} onClick={() => setPagina(pagina + 1)}>Siguientes →</button>
          </nav>
        )}
      </section>

      {/* Confirmación antes de cancelar (libera la hora para otro cliente). */}
      {cancelando && (
        <Confirmar
          titulo="Cancelar cita"
          textoAccion="Sí, cancelarla"
          onCerrar={() => setCancelando(null)}
          onConfirmar={async () => { setCancelando(null); await cambiarEstado(cancelando, 'cancelado') }}
        >
          ¿Cancelar la cita de <strong>{cancelando.nombre_cliente}</strong> del {formatoFecha(cancelando.fecha)}? La hora quedará libre para otro cliente.
        </Confirmar>
      )}
    </AdminLayout>
  )
}
