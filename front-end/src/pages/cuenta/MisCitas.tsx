import { useState } from 'react'
import CuentaLayout from '../../components/CuentaLayout'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import Confirmar from '../../components/Confirmar'
import TarjetaCita from '../../components/TarjetaCita'
import { api, formatoFecha, type Cita } from '../../lib/api'
import { avisar } from '../../lib/avisos'
import { botonPeligro, botonPildora, enlaceDorado } from '../../lib/estilos'
import Link from '../../components/Link'
import { cargarMisCitas, cargarMisResenas, MIS_CITAS, MIS_RESENAS } from '../../lib/datos'
import { useDatos } from '../../lib/useDatos'

const subtitulo = 'mb-3.5 font-titulo text-[30px] leading-[1.1] font-bold text-tinto-texto'
// Pie de cada tarjeta: botón de cancelar (próximas) o enlace para reseñar / ver reseña (terminadas).
const pieTarjeta = 'mt-1 flex flex-wrap items-center justify-end gap-3'

/* Panel del cliente: sus citas, con opción de cancelar las próximas y de reseñar las terminadas. */
export default function MisCitas() {
  // Las dos pantallas de la cuenta usan las mismas claves: al pasar de una a otra no se vuelve a esperar
  const citas = useDatos(MIS_CITAS, cargarMisCitas)
  const resenas = useDatos(MIS_RESENAS, cargarMisResenas)
  const [cancelando, setCancelando] = useState<Cita | null>(null)
  const [ahora] = useState(Date.now)

  const conResena = new Set(resenas.datos?.map((r) => r.cita_id))
  const lista = citas.datos ?? []
  // Próximas: de la más cercana a la más lejana. Historial: la más reciente primero (como llegan).
  // Separa las citas: "Próximas" (próximo / en proceso) e "Historial" (terminado / cancelado). Solo se puede cancelar una cita futura.
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
    // PANTALLA "MIS CITAS" (pestaña de la cuenta del cliente).
    <CuentaLayout titulo="Mi cuenta" menu>
      {/* Estados: cargando, error y sin citas (con enlace a agendar). */}
      {citas.cargando && !citas.datos && <Cargando />}
      {citas.error && <MensajeError texto={citas.error} reintentar={citas.recargar} />}
      {citas.datos?.length === 0 && (
        <p className="py-5 font-texto text-base text-texto-secundario">
          Todavía no tienes citas. <Link to="/agendar" className={`${enlaceDorado} text-base`}>Agenda una</Link>
        </p>
      )}

      {lista.length > 0 && (
        <>
          {/* BLOQUE PRÓXIMAS: citas pendientes ordenadas de la más cercana a la más lejana. */}
          <section className="mb-10">
            <h2 className={subtitulo}>Próximas</h2>
            {proximas.length === 0 && <Vacio texto="No tienes citas próximas." />}
            <div className="flex flex-col gap-4">
              {proximas.map((c) => <TarjetaCita key={c.id} cita={c}>{pie(c)}</TarjetaCita>)}
            </div>
          </section>
          {/* BLOQUE HISTORIAL: citas terminadas y canceladas. */}
          <section>
            <h2 className={subtitulo}>Historial</h2>
            {historial.length === 0 && <Vacio texto="Aquí aparecerán tus citas terminadas y canceladas." />}
            <div className="flex flex-col gap-4">
              {historial.map((c) => <TarjetaCita key={c.id} cita={c}>{pie(c)}</TarjetaCita>)}
            </div>
          </section>
        </>
      )}

      {/* Ventana de confirmación para cancelar la cita elegida. */}
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
  return (
    <Confirmar
      titulo="Cancelar cita"
      textoAccion="Sí, cancelar"
      textoCancelar="No, conservarla"
      onCerrar={onCerrar}
      onConfirmar={async () => {
        await api(`/citas/mias/${cita.id}/cancelar`, { method: 'PATCH' })
        avisar('Tu cita quedó cancelada')
        onCancelada()
      }}
    >
      ¿Seguro que quieres cancelar tu cita del <strong>{formatoFecha(cita.fecha)}</strong>? Esta acción no se puede deshacer.
    </Confirmar>
  )
}
