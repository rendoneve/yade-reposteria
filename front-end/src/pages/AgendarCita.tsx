import { X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import Encabezado from '../components/Encabezado'
import Link from '../components/Link'
import Pie from '../components/Pie'
import {
  api,
  ErrorApi,
  ETIQUETA_SERVICIO,
  formatoFecha,
  type AgendaDia,
  type Horario,
} from '../lib/api'
import {
  botonOscuro,
  campoPublico,
  chipProducto,
  controlPublico,
  degradadoHero,
  enlaceDorado,
  errorPublico,
  hero,
  heroLinea,
  heroTitulo,
  pagina,
  tarjetaCrema,
} from '../lib/estilos'
import { CATEGORIAS, cargarCategorias, cargarOpcionesProductos, OPCIONES_PRODUCTOS } from '../lib/datos'
import { useNegocio } from '../lib/negocio'
import { useRuta } from '../lib/router'
import { useSesion } from '../lib/sesion'
import { useDatos } from '../lib/useDatos'

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const DIAS_MAXIMOS = 180

/* Convierte fecha + hora locales del navegador a ISO con zona (solo si el negocio no tiene horarios). */
function aIsoConZona(fecha: string, hora: string): string {
  const d = new Date(`${fecha}T${hora}`)
  const off = -d.getTimezoneOffset()
  const signo = off >= 0 ? '+' : '-'
  return `${fecha}T${hora}:00${signo}${pad(Math.floor(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`
}

/* Primer día abierto a partir de mañana (si no hay horarios configurados, mañana). */
function primerDiaAbierto(horarios: Horario[] | undefined): string {
  const d = new Date()
  for (let i = 1; i <= 8; i++) {
    d.setDate(d.getDate() + 1)
    const h = horarios?.find((x) => x.dia_semana === d.getDay())
    if (!horarios?.some((x) => !x.cerrado) || (h && !h.cerrado)) return ymd(d)
  }
  return ymd(d)
}

const hora = (h: string | null) => (h ? h.slice(0, 5) : '')
// "2026-10-30T10:30:00-07:00" -> "10:30" (la hora local del negocio, tal como la manda el servidor)
const horaDeIso = (iso: string) => iso.slice(11, 16)

const tarjetaForm = `${tarjetaCrema} flex flex-col gap-4 px-[34px] py-8 max-[560px]:px-5`
const chipHora =
  'h-9 rounded-lg border border-rosa-vino bg-white font-texto text-[15px] text-tinto-texto transition-colors enabled:hover:border-tinto aria-pressed:border-tinto aria-pressed:bg-tinto aria-pressed:text-white disabled:cursor-not-allowed disabled:bg-transparent disabled:text-texto-secundario/60 disabled:line-through'


/* Formulario de cita (no está en Figma; usa los mismos estilos del sitio). */
export default function AgendarCita() {
  const { query } = useRuta()
  const { usuario } = useSesion()
  const { negocio } = useNegocio()
  const idProducto = Number(query.get('producto')) || null
  const categorias = useDatos(CATEGORIAS, cargarCategorias)
  const catalogo = useDatos(OPCIONES_PRODUCTOS, cargarOpcionesProductos)
  // Productos que se piden en la cita (quedan ligados a ella y, después, a la reseña)
  const [elegidos, setElegidos] = useState<number[]>(() => (idProducto ? [idProducto] : []))

  const [fechaElegida, setFecha] = useState<string | null>(null)
  const fecha = fechaElegida ?? primerDiaAbierto(negocio?.horarios)
  const [inicio, setInicio] = useState<string | null>(null) // franja elegida (ISO del servidor)
  // Solo vale si es del día que se ve: el día puede cambiar solo (al llegar los horarios del negocio)
  // y no se debe agendar una hora de otro día que quedó elegida
  const horaElegida = inicio?.startsWith(`${fecha}T`) ? inicio : null
  const agenda = useDatos(`agenda:${fecha}`, () => api<AgendaDia>('/citas/disponibilidad', { params: { fecha } }))

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmada, setConfirmada] = useState<{ fecha: string; nombre: string } | null>(null)

  const hoy = new Date()
  const minimo = ymd(hoy)
  const maximo = ymd(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + DIAS_MAXIMOS))
  const sinHorarios = agenda.datos?.configurado === false

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const fechaIso = sinHorarios ? aIsoConZona(fecha, String(f.get('hora'))) : horaElegida
    if (!fechaIso) {
      setError('Elige una hora disponible.')
      return
    }
    setEnviando(true)
    setError(null)
    const nombre = String(f.get('nombre')).trim()
    try {
      const r = await api<{ fecha: string }>('/citas', {
        method: 'POST',
        body: {
          fecha: fechaIso,
          nombre_cliente: nombre,
          telefono: String(f.get('telefono')).trim(),
          correo: String(f.get('correo')).trim() || null,
          tipo_servicio: String(f.get('tipo')),
          detalles: String(f.get('detalles')).trim() || null,
          producto_ids: elegidos,
        },
      })
      setConfirmada({ fecha: r.fecha, nombre })
      window.scrollTo(0, 0)
    } catch (err) {
      setError((err as Error).message)
      // Alguien más apartó esa hora mientras se llenaba el formulario: se actualizan las horas
      if (err instanceof ErrorApi && err.status === 409) { setInicio(null); agenda.recargar() }
    } finally {
      setEnviando(false)
    }
  }

  const nombreProducto = (id: number) => catalogo.datos?.find((p) => p.id === id)?.nombre ?? 'Producto'
  const disponibles = (catalogo.datos ?? []).filter((p) => !elegidos.includes(p.id))
  const entrarYVolver = `/entrar?siguiente=${encodeURIComponent(location.pathname + location.search)}`
  // Una categoría que se llame igual que un servicio ("Pasteles") se muestra una sola vez
  const servicioDe = (nombre: string) =>
    Object.keys(ETIQUETA_SERVICIO).find((k) => ETIQUETA_SERVICIO[k].toLowerCase() === nombre.trim().toLowerCase())
  const categoriasExtra = (categorias.datos ?? []).filter((c) => !servicioDe(c.nombre))
  const nombreCategoria = catalogo.datos?.find((p) => p.id === idProducto)?.categoria_nombre
  const tipoInicial = nombreCategoria ? (servicioDe(nombreCategoria) ?? nombreCategoria) : 'pasteles'
  const whatsapp = negocio?.whatsapp?.replace(/\D/g, '')
  // Lunes primero
  const horarios = negocio ? [...negocio.horarios].sort((a, b) => ((a.dia_semana + 6) % 7) - ((b.dia_semana + 6) % 7)) : []

  return (
    <div className={pagina}>
      <section className={`${hero} ${degradadoHero} h-[280px]`}>
        <Encabezado />
        <h1 className={`${heroTitulo} top-[110px] h-[110px]`}>
          <span className={heroLinea}>Agendar cita</span>
        </h1>
      </section>
      <main className="flex-1 px-margen pt-[60px] pb-[100px] max-[760px]:px-4 max-[760px]:pt-10 max-[760px]:pb-20">
        {confirmada ? (
          <div className={`${tarjetaForm} mx-auto max-w-[620px]`} role="status">
            <h2 className="font-titulo text-[34px] leading-[1.1] font-bold text-exito">¡Listo! Tu cita quedó agendada</h2>
            <p className="font-texto text-lg leading-normal">Te esperamos el {formatoFecha(confirmada.fecha)}.</p>
            {whatsapp && (
              <a
                className={`${botonOscuro} flex items-center justify-center`}
                href={`https://wa.me/${whatsapp}?text=${encodeURIComponent(`Hola, acabo de agendar una cita para el ${formatoFecha(confirmada.fecha)} a nombre de ${confirmada.nombre}.`)}`}
                target="_blank"
                rel="noreferrer"
              >
                Avisar por WhatsApp
              </a>
            )}
            {usuario ? (
              <p className="font-texto text-base leading-normal">
                Puedes verla o cancelarla en <Link to="/cuenta/citas" className={`${enlaceDorado} text-base`}>Mis citas</Link>.
              </p>
            ) : (
              <p className="font-texto text-base leading-normal text-texto-secundario">
                Si necesitas cambiarla, escríbenos por WhatsApp. ¿Quieres seguir tus citas y dejar reseñas?{' '}
                <Link to="/registro" className={`${enlaceDorado} text-base`}>Crea una cuenta</Link> antes de agendar la próxima.
              </p>
            )}
          </div>
        ) : (
          <div className="mx-auto grid max-w-[980px] grid-cols-[1fr_300px] items-start gap-6 max-[900px]:max-w-[620px] max-[900px]:grid-cols-1">
            <form className={tarjetaForm} onSubmit={enviar} key={`${tipoInicial}|${categoriasExtra.length}|${usuario?.id}`}>
              {!usuario && (
                <p className="font-texto text-[15px] leading-normal text-texto-secundario">
                  ¿Tienes cuenta? <Link to={entrarYVolver} className={`${enlaceDorado} text-[15px]`}>Inicia sesión</Link> para
                  ver esta cita en tu panel, cancelarla y dejar tu reseña cuando termine.
                </p>
              )}
              <label className={campoPublico}>
                Día
                <input
                  className={controlPublico} name="dia" type="date" required min={minimo} max={maximo} value={fecha}
                  onChange={(e) => { if (e.target.value) { setFecha(e.target.value); setInicio(null) } }}
                />
              </label>

              <fieldset className={campoPublico}>
                <legend className="mb-1.5">Hora</legend>
                {agenda.cargando && <p className="font-texto text-[15px] font-normal text-texto-secundario">Buscando horas disponibles…</p>}
                {agenda.error && <p className={errorPublico}>{agenda.error}</p>}
                {sinHorarios && (
                  <input className={controlPublico} name="hora" type="time" required defaultValue="11:00" />
                )}
                {agenda.datos?.configurado && !agenda.datos.abierto && (
                  <p className="font-texto text-[15px] font-normal text-error">Ese día no abrimos. Elige otro día.</p>
                )}
                {agenda.datos?.configurado && agenda.datos.abierto && (
                  agenda.datos.franjas.some((f) => f.disponible) ? (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(76px,1fr))] gap-2" role="group" aria-label="Horas disponibles">
                      {agenda.datos.franjas.map((f) => (
                        <button
                          key={f.inicio}
                          type="button"
                          className={chipHora}
                          disabled={!f.disponible}
                          aria-pressed={horaElegida === f.inicio}
                          aria-label={`${horaDeIso(f.inicio)}${f.disponible ? '' : ' (ocupada)'}`}
                          onClick={() => setInicio(f.inicio)}
                        >
                          {horaDeIso(f.inicio)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="font-texto text-[15px] font-normal text-error">Ya no quedan horas ese día. Prueba con otro.</p>
                  )
                )}
              </fieldset>

              <label className={campoPublico}>
                Nombre
                <input className={controlPublico} name="nombre" required maxLength={100} autoComplete="name" defaultValue={usuario?.nombre_completo} />
              </label>
              <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
                <label className={campoPublico}>
                  Teléfono
                  <input className={controlPublico} name="telefono" required type="tel" pattern="[0-9+()\s\-]{7,20}" autoComplete="tel" defaultValue={usuario?.telefono ?? ''} />
                </label>
                <label className={campoPublico}>
                  Correo (opcional)
                  <input className={controlPublico} name="correo" type="email" autoComplete="email" defaultValue={usuario?.correo} />
                </label>
              </div>
              <label className={campoPublico}>
                Tipo de servicio
                <select className={controlPublico} name="tipo" required defaultValue={tipoInicial}>
                  <optgroup label="Servicios">
                    {Object.entries(ETIQUETA_SERVICIO).map(([valor, texto]) => (
                      <option key={valor} value={valor}>{texto}</option>
                    ))}
                  </optgroup>
                  {categoriasExtra.length > 0 && (
                    <optgroup label="Categorías">
                      {categoriasExtra.map((c) => (
                        <option key={c.id} value={c.nombre}>{c.nombre}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <fieldset className={campoPublico}>
                <legend className="mb-1.5">Productos (opcional)</legend>
                {elegidos.length > 0 && (
                  <ul className="mb-2 flex flex-wrap gap-1.5">
                    {elegidos.map((id) => (
                      <li key={id} className={`${chipProducto} flex items-center gap-1 pr-1 font-normal`}>
                        {nombreProducto(id)}
                        <button
                          type="button"
                          className="grid size-5 place-items-center rounded-full hover:bg-tinto/10"
                          aria-label={`Quitar ${nombreProducto(id)}`}
                          onClick={() => setElegidos(elegidos.filter((e) => e !== id))}
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <select
                  className={controlPublico}
                  value=""
                  aria-label="Agregar un producto"
                  disabled={!disponibles.length || elegidos.length >= 20}
                  onChange={(e) => e.target.value && setElegidos([...elegidos, Number(e.target.value)])}
                >
                  <option value="">{catalogo.cargando ? 'Cargando productos…' : 'Agregar un producto…'}</option>
                  {disponibles.map((p) => (
                    <option key={p.id} value={p.id}>{p.nombre} · {p.categoria_nombre}</option>
                  ))}
                </select>
              </fieldset>
              <label className={campoPublico}>
                Detalles
                <textarea className={controlPublico} name="detalles" rows={4} maxLength={2000} placeholder="Sabor, número de personas, decoración…" />
              </label>
              {error && <p className={errorPublico} role="alert">{error}</p>}
              <button className={botonOscuro} type="submit" disabled={enviando}>
                {enviando ? 'Enviando…' : 'Agendar cita'}
              </button>
            </form>

            {horarios.some((h) => !h.cerrado) && (
              <aside className={`${tarjetaCrema} px-6 py-5`} aria-label="Horarios">
                <h2 className="mb-2 font-titulo text-[26px] leading-[1.2] font-bold text-tinto-texto">Horarios</h2>
                <ul className="font-texto text-[15px] leading-[1.4]">
                  {horarios.map((h) => (
                    <li key={h.dia_semana} className="flex justify-between border-b border-tinto-texto/15 py-1.5">
                      <span>{h.dia}</span>
                      <span>{h.cerrado ? 'Cerrado' : `${hora(h.abre)} – ${hora(h.cierra)}`}</span>
                    </li>
                  ))}
                </ul>
                {agenda.datos?.duracion_minutos && (
                  <p className="mt-3 font-texto text-[13px] text-texto-secundario">Cada cita dura {agenda.datos.duracion_minutos} minutos.</p>
                )}
              </aside>
            )}
          </div>
        )}
      </main>
      <Pie />
    </div>
  )
}
