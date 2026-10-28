import { useState } from 'react'
import CuentaLayout from '../../components/CuentaLayout'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import Modal from '../../components/Modal'
import TarjetaCita from '../../components/TarjetaCita'
import { api, formatoFecha, type Cita, type Resena } from '../../lib/api'
import { accionesAdmin, botonPeligro, botonPildora, enlaceDorado, errorPublico } from '../../lib/estilos'
import { Link } from '../../lib/router'
import { useDatos } from '../../lib/useDatos'

const subtitulo = 'mb-3.5 font-titulo text-[30px] leading-[1.1] font-bold text-tinto-texto'
const pieTarjeta = 'mt-1 flex flex-wrap items-center justify-end gap-3'

/* Panel del cliente: sus citas, con opción de cancelar las próximas y de reseñar las terminadas. */
export default function MisCitas() {
  const citas = useDatos(() => api<Cita[]>('/citas/mias'))
  const resenas = useDatos(() => api<Resena[]>('/resenas/mias'))
  const [cancelando, setCancelando] = useState<Cita | null>(null)
  const [ahora] = useState(Date.now)

  const conResena = new Set(resenas.datos?.map((r) => r.cita_id))
  const lista = citas.datos ?? []
  // Próximas: de la más cercana a la más lejana. Historial: la más reciente primero (como llegan).
  const proximas = lista.filter((c) => c.estado === 'proximo' || c.estado === 'en proceso').reverse()
  const historial = lista.filter((c) => c.estado === 'terminado' || c.estado === 'cancelado')
  const puedeCancelar = (c: Cita) => c.estado === 'proximo' && new Date(c.fecha).getTime() > ahora

  const pie = (c: Cita) => {
    if (puedeCancelar(c)) {
      return (
        <div className={pieTarjeta}>
          <button type="button" className={`${botonPeligro} mr-0!`} onClick={() => setCancelando(c)}>Cancelar cita</button>
        </div>
      )
    }
    if (c.estado !== 'terminado') return null
    return (
      <div className={pieTarjeta}>
        {conResena.has(c.id)
          ? <Link to="/cuenta/resenas" className={`${enlaceDorado} text-[15px]`}>Ver mi reseña</Link>
          : <Link to={`/cuenta/resenas?cita=${c.id}`} className={`${botonPildora} inline-block hover:bg-tinto`}>Dejar reseña</Link>}
      </div>
    )
  }

  return (
    <CuentaLayout titulo="Mi cuenta" menu>
      {citas.cargando && !citas.datos && <Cargando />}
      {citas.error && <MensajeError texto={citas.error} reintentar={citas.recargar} />}
      {citas.datos?.length === 0 && (
        <p className="py-5 font-texto text-base text-texto-secundario">
          Todavía no tienes citas. <Link to="/agendar" className={`${enlaceDorado} text-base`}>Agenda una</Link>
        </p>
      )}

      {lista.length > 0 && (
        <>
          <section className="mb-10">
            <h2 className={subtitulo}>Próximas</h2>
            {proximas.length === 0 && <Vacio texto="No tienes citas próximas." />}
            <div className="flex flex-col gap-4">
              {proximas.map((c) => <TarjetaCita key={c.id} cita={c}>{pie(c)}</TarjetaCita>)}
            </div>
          </section>
          <section>
            <h2 className={subtitulo}>Historial</h2>
            {historial.length === 0 && <Vacio texto="Aquí aparecerán tus citas terminadas y canceladas." />}
            <div className="flex flex-col gap-4">
              {historial.map((c) => <TarjetaCita key={c.id} cita={c}>{pie(c)}</TarjetaCita>)}
            </div>
          </section>
        </>
      )}

      {cancelando && (
        <ConfirmarCancelacion
          cita={cancelando}
          onCerrar={() => setCancelando(null)}
          onCancelada={() => { setCancelando(null); citas.recargar() }}
        />
      )}
    </CuentaLayout>
  )
}

function ConfirmarCancelacion({ cita, onCerrar, onCancelada }: { cita: Cita; onCerrar: () => void; onCancelada: () => void }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cancelar = async () => {
    setEnviando(true)
    setError(null)
    try {
      await api(`/citas/mias/${cita.id}/cancelar`, { method: 'PATCH' })
      onCancelada()
    } catch (err) {
      setError((err as Error).message)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo="Cancelar cita" onCerrar={onCerrar}>
      <p className="font-texto text-base leading-normal">
        ¿Seguro que quieres cancelar tu cita del <strong>{formatoFecha(cita.fecha)}</strong>? Esta acción no se puede deshacer.
      </p>
      {error && <p className={`${errorPublico} mt-3`} role="alert">{error}</p>}
      <div className={`${accionesAdmin} mt-5`}>
        <button type="button" className={`${botonPildora} bg-transparent text-tinto-texto! enabled:hover:bg-tinto/10`} onClick={onCerrar}>
          No, conservarla
        </button>
        <button type="button" className={`${botonPeligro} mr-0!`} onClick={cancelar} disabled={enviando}>
          {enviando ? 'Cancelando…' : 'Sí, cancelar'}
        </button>
      </div>
    </Modal>
  )
}
