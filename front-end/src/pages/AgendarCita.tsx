import { useState, type FormEvent } from 'react'
import Encabezado from '../components/Encabezado'
import Pie from '../components/Pie'
import { api, ETIQUETA_SERVICIO, formatoFecha, type Producto, type TipoServicio } from '../lib/api'
import { botonOscuro, campoPublico, controlPublico, degradadoHero, hero, heroLinea, heroTitulo, pagina, tarjetaCrema } from '../lib/estilos'
import { useRuta } from '../lib/router'
import { useDatos } from '../lib/useDatos'

/* Convierte el valor de <input type="datetime-local"> a ISO con la zona horaria del navegador. */
function aIsoConZona(local: string): string {
  const d = new Date(local)
  const off = -d.getTimezoneOffset()
  const signo = off >= 0 ? '+' : '-'
  const hh = String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')
  const mm = String(Math.abs(off) % 60).padStart(2, '0')
  return `${local.length === 16 ? local + ':00' : local}${signo}${hh}:${mm}`
}

function mananaALas(hora: number) {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(hora, 0, 0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`
}

const tarjetaForm = `${tarjetaCrema} mx-auto flex max-w-[620px] flex-col gap-4 px-[34px] py-8 max-[560px]:px-5`

/* Formulario de cita (no está en Figma; usa los mismos estilos del sitio). */
export default function AgendarCita() {
  const { query } = useRuta()
  const idProducto = Number(query.get('producto')) || null
  const producto = useDatos(
    () => (idProducto ? api<Producto>(`/productos/${idProducto}`) : Promise.resolve(null)),
    [idProducto],
  )

  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmada, setConfirmada] = useState<{ fecha: string } | null>(null)

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setEnviando(true)
    setError(null)
    try {
      const r = await api<{ fecha: string }>('/citas', {
        method: 'POST',
        body: {
          fecha: aIsoConZona(String(f.get('fecha'))),
          nombre_cliente: String(f.get('nombre')).trim(),
          telefono: String(f.get('telefono')).trim(),
          correo: String(f.get('correo')).trim() || null,
          tipo_servicio: f.get('tipo') as TipoServicio,
          detalles: String(f.get('detalles')).trim() || null,
        },
      })
      setConfirmada(r)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const detallesIniciales = producto.datos ? `Me interesa: ${producto.datos.nombre}` : ''

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
          <div className={tarjetaForm} role="status">
            <h2 className="font-titulo text-[34px] leading-[1.1] font-bold text-exito">¡Listo! Tu cita quedó agendada</h2>
            <p className="font-texto text-lg leading-normal">Te esperamos el {formatoFecha(confirmada.fecha)}. Si necesitas cambiarla, contáctanos por WhatsApp.</p>
          </div>
        ) : (
          <form className={tarjetaForm} onSubmit={enviar} key={detallesIniciales}>
            <label className={campoPublico}>
              Fecha y hora
              <input className={controlPublico} name="fecha" type="datetime-local" required defaultValue={mananaALas(11)} />
            </label>
            <label className={campoPublico}>
              Nombre
              <input className={controlPublico} name="nombre" required maxLength={100} autoComplete="name" />
            </label>
            <div className="grid grid-cols-2 gap-4 max-[760px]:grid-cols-1">
              <label className={campoPublico}>
                Teléfono
                <input className={controlPublico} name="telefono" required type="tel" pattern="[0-9+()\s\-]{7,20}" autoComplete="tel" />
              </label>
              <label className={campoPublico}>
                Correo (opcional)
                <input className={controlPublico} name="correo" type="email" autoComplete="email" />
              </label>
            </div>
            <label className={campoPublico}>
              Tipo de servicio
              <select className={controlPublico} name="tipo" defaultValue="pasteles">
                {(Object.keys(ETIQUETA_SERVICIO) as TipoServicio[]).map((t) => (
                  <option key={t} value={t}>{ETIQUETA_SERVICIO[t]}</option>
                ))}
              </select>
            </label>
            <label className={campoPublico}>
              Detalles
              <textarea className={controlPublico} name="detalles" rows={4} maxLength={2000} defaultValue={detallesIniciales} />
            </label>
            {error && <p className="font-ui text-sm leading-[1.4] font-semibold text-error" role="alert">{error}</p>}
            <button className={botonOscuro} type="submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Agendar cita'}
            </button>
          </form>
        )}
      </main>
      <Pie />
    </div>
  )
}
