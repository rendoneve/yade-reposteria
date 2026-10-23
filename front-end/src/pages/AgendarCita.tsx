import { useState, type FormEvent } from 'react'
import Encabezado from '../components/Encabezado'
import Pie from '../components/Pie'
import { api, ETIQUETA_SERVICIO, formatoFecha, type Producto, type TipoServicio } from '../lib/api'
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
    <div className="pagina">
      <section className="hero hero--corto">
        <Encabezado />
        <h1 className="hero__titulo hero__titulo--corto">
          <span className="hero__linea">Agendar cita</span>
        </h1>
      </section>
      <main className="formulario-pagina">
        {confirmada ? (
          <div className="tarjeta-form tarjeta-form--ok" role="status">
            <h2>¡Listo! Tu cita quedó agendada</h2>
            <p>Te esperamos el {formatoFecha(confirmada.fecha)}. Si necesitas cambiarla, contáctanos por WhatsApp.</p>
          </div>
        ) : (
          <form className="tarjeta-form" onSubmit={enviar} key={detallesIniciales}>
            <label>
              Fecha y hora
              <input name="fecha" type="datetime-local" required defaultValue={mananaALas(11)} />
            </label>
            <label>
              Nombre
              <input name="nombre" required maxLength={100} autoComplete="name" />
            </label>
            <div className="tarjeta-form__fila">
              <label>
                Teléfono
                <input name="telefono" required type="tel" pattern="[0-9+()\s\-]{7,20}" autoComplete="tel" />
              </label>
              <label>
                Correo (opcional)
                <input name="correo" type="email" autoComplete="email" />
              </label>
            </div>
            <label>
              Tipo de servicio
              <select name="tipo" defaultValue="pasteles">
                {(Object.keys(ETIQUETA_SERVICIO) as TipoServicio[]).map((t) => (
                  <option key={t} value={t}>{ETIQUETA_SERVICIO[t]}</option>
                ))}
              </select>
            </label>
            <label>
              Detalles
              <textarea name="detalles" rows={4} maxLength={2000} defaultValue={detallesIniciales} />
            </label>
            {error && <p className="tarjeta-form__error" role="alert">{error}</p>}
            <button className="boton-oscuro" type="submit" disabled={enviando}>
              {enviando ? 'Enviando…' : 'Agendar cita'}
            </button>
          </form>
        )}
      </main>
      <Pie />
    </div>
  )
}
