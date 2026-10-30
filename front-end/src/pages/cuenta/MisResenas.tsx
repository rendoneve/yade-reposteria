import { useState, type FormEvent } from 'react'
import CuentaLayout from '../../components/CuentaLayout'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import { Estrellas, SelectorEstrellas } from '../../components/Estrellas'
import TarjetaCita from '../../components/TarjetaCita'
import { api, formatoDia, formatoFecha, type Cita } from '../../lib/api'
import { botonPildora, campoPublico, chipProducto, controlPublico, errorPublico, tarjetaCrema } from '../../lib/estilos'
import { avisar } from '../../lib/avisos'
import { useRuta } from '../../lib/router'
import { cargarMisCitas, cargarMisResenas, MIS_CITAS, MIS_RESENAS } from '../../lib/datos'
import { useDatos } from '../../lib/useDatos'

const subtitulo = 'mb-3.5 font-titulo text-[30px] leading-[1.1] font-bold text-tinto-texto'

/* Panel del cliente: reseñas. Solo se pueden reseñar las citas terminadas, una vez cada una;
   la reseña queda ligada a la cita y a sus productos. */
export default function MisResenas() {
  const { query } = useRuta()
  const citaElegida = Number(query.get('cita')) || null
  // Las dos pantallas de la cuenta usan las mismas claves: al pasar de una a otra no se vuelve a esperar
  const citas = useDatos(MIS_CITAS, cargarMisCitas)
  const resenas = useDatos(MIS_RESENAS, cargarMisResenas)

  const conResena = new Set(resenas.datos?.map((r) => r.cita_id))
  // "Pendientes" = citas terminadas sin reseña. ?cita=ID (desde Mis citas) abre el formulario de esa cita enfocado.
  const pendientes = resenas.datos
    ? (citas.datos ?? []).filter((c) => c.estado === 'terminado' && !conResena.has(c.id))
    : []
  const fechaCita = new Map(citas.datos?.map((c) => [c.id, c.fecha]))

  return (
    // PANTALLA "MIS RESEÑAS" (pestaña de la cuenta del cliente).
    <CuentaLayout titulo="Mi cuenta" menu>
      {(citas.cargando || resenas.cargando) && !(citas.datos && resenas.datos) && <Cargando />}
      {citas.error && <MensajeError texto={citas.error} reintentar={citas.recargar} />}
      {resenas.error && <MensajeError texto={resenas.error} reintentar={resenas.recargar} />}

      {citas.datos && resenas.datos && (
        <>
          {/* BLOQUE POR RESEÑAR: formulario de calificación y texto para cada cita terminada sin reseña. */}
          <section className="mb-10">
            <h2 className={subtitulo}>Por reseñar</h2>
            {pendientes.length === 0 && (
              <Vacio texto="Cuando una de tus citas termine, aquí podrás contarnos qué te parecieron tus postres." />
            )}
            <div className="flex flex-col gap-4">
              {pendientes.map((c) => (
                <TarjetaCita key={c.id} cita={c}>
                  <FormResena cita={c} enfocar={c.id === citaElegida} onPublicada={resenas.recargar} />
                </TarjetaCita>
              ))}
            </div>
          </section>

          {/* BLOQUE MIS RESEÑAS: reseñas ya enviadas, con su estado de moderación. */}
          <section>
            <h2 className={subtitulo}>Mis reseñas</h2>
            {resenas.datos.length === 0 && <Vacio texto="Todavía no has dejado reseñas." />}
            <div className="flex flex-col gap-4">
              {resenas.datos.map((r) => {
                const fecha = r.cita_id ? fechaCita.get(r.cita_id) : undefined
                return (
                  <article key={r.id} className={`${tarjetaCrema} flex flex-col gap-2.5 px-7 py-5 max-[560px]:px-5`}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-ui text-[13px] font-semibold text-dorado-texto">
                        {formatoDia(r.fecha)}{fecha && ` · Cita del ${formatoFecha(fecha)}`}
                      </p>
                      <span
                        className={`rounded-[9px] px-2.5 py-0.5 font-ui text-xs font-semibold ${r.aprobada ? 'bg-exito/15 text-exito' : 'bg-caramelo/40 text-dorado-texto'}`}
                      >
                        {r.aprobada ? 'Publicada' : 'En revisión'}
                      </span>
                    </div>
                    {r.calificacion && <Estrellas valor={r.calificacion} />}
                    {r.productos.length > 0 && (
                      <ul className="flex flex-wrap gap-1.5" aria-label="Productos">
                        {r.productos.map((p) => <li key={p.id} className={chipProducto}>{p.nombre}</li>)}
                      </ul>
                    )}
                    <p className="font-texto text-base leading-normal whitespace-pre-line">{r.descripcion}</p>
                  </article>
                )
              })}
            </div>
          </section>
        </>
      )}
    </CuentaLayout>
  )
}

function FormResena({ cita, enfocar, onPublicada }: { cita: Cita; enfocar: boolean; onPublicada: () => void }) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [calificacion, setCalificacion] = useState(0)

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    if (calificacion === 0) {
      setError('Elige cuántas estrellas le das a tu experiencia')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await api('/resenas/mias', {
        method: 'POST',
        body: { cita_id: cita.id, descripcion: String(f.get('descripcion')).trim(), calificacion },
      })
      avisar('¡Gracias! Tu reseña se publicará en cuanto la revisemos')
      onPublicada()
    } catch (err) {
      setError((err as Error).message)
      setEnviando(false)
    }
  }

  return (
    // FORMULARIO DE RESEÑA: estrellas (1–5) y comentario. Queda pendiente hasta que el admin la apruebe.
    <form className="mt-1 flex flex-col gap-2.5 border-t border-tinto-texto/15 pt-3.5" onSubmit={enviar}>
      <div className={campoPublico}>
        Tu calificación
        <SelectorEstrellas valor={calificacion} onCambio={setCalificacion} />
      </div>
      <label className={campoPublico}>
        Tu reseña
        <textarea
          className={controlPublico} name="descripcion" rows={3} required maxLength={2000}
          placeholder="¿Qué te parecieron tus postres?" autoFocus={enfocar}
        />
      </label>
      {error && <p className={errorPublico} role="alert">{error}</p>}
      <button className={`${botonPildora} self-end`} type="submit" disabled={enviando}>
        {enviando ? 'Enviando…' : 'Enviar reseña'}
      </button>
    </form>
  )
}
