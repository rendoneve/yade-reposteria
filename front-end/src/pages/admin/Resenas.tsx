import { useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import Confirmar from '../../components/Confirmar'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import { Estrellas } from '../../components/Estrellas'
import { api, formatoDia, type Resena } from '../../lib/api'
import { avisar } from '../../lib/avisos'
import { botonPeligro, botonPildora, chipFiltro, chipProducto, tarjetaCrema } from '../../lib/estilos'
import { useDatos } from '../../lib/useDatos'

const cargarResenas = () => api<Resena[]>('/resenas/admin', { params: { estado: 'todas', limit: 500 } })

type Pestana = 'pendientes' | 'publicadas' | 'todas'

/* ADMINISTRADOR reseñas: las de los clientes llegan "pendientes" y no se ven en el sitio
   hasta que se aprueban. También se pueden ocultar las ya publicadas o eliminarlas. */
export default function Resenas() {
  const resenas = useDatos('resenas:admin', cargarResenas)
  const [borrando, setBorrando] = useState<Resena | null>(null)
  const [pestana, setPestana] = useState<Pestana>('pendientes')
  const [texto, setTexto] = useState('')
  const [trabajando, setTrabajando] = useState<number | null>(null)

  const todas = resenas.datos ?? []
  const pendientes = todas.filter((r) => !r.aprobada)
  const publicadas = todas.filter((r) => r.aprobada)
  const base = pestana === 'pendientes' ? pendientes : pestana === 'publicadas' ? publicadas : todas

  const filtro = texto.trim().toLowerCase()
  const lista = base.filter(
    (r) =>
      !filtro ||
      r.nombre_cliente.toLowerCase().includes(filtro) ||
      r.descripcion.toLowerCase().includes(filtro) ||
      r.productos.some((p) => p.nombre.toLowerCase().includes(filtro)),
  )

  const moderar = async (r: Resena, aprobada: boolean) => {
    setTrabajando(r.id)
    try {
      await api(`/resenas/${r.id}`, { method: 'PATCH', body: { aprobada } })
      avisar(aprobada ? `Reseña de ${r.nombre_cliente} publicada` : `Reseña de ${r.nombre_cliente} oculta`)
      resenas.recargar()
    } catch (e) {
      avisar((e as Error).message)
    } finally {
      setTrabajando(null)
    }
  }

  const eliminar = async (r: Resena) => {
    await api(`/resenas/${r.id}`, { method: 'DELETE' })
    setBorrando(null)
    avisar(`Reseña de ${r.nombre_cliente} eliminada`)
    resenas.recargar()
  }

  const pestanas: { id: Pestana; texto: string; cantidad: number }[] = [
    { id: 'pendientes', texto: 'Por revisar', cantidad: pendientes.length },
    { id: 'publicadas', texto: 'Publicadas', cantidad: publicadas.length },
    { id: 'todas', texto: 'Todas', cantidad: todas.length },
  ]

  const vacio = {
    pendientes: 'No hay reseñas por revisar. Las nuevas de tus clientes aparecerán aquí.',
    publicadas: 'Todavía no hay reseñas publicadas.',
    todas: 'Todavía no hay reseñas. Aparecerán cuando los clientes reseñen sus citas terminadas.',
  }[pestana]

  return (
    // PANTALLA DE RESEÑAS DEL ADMIN (moderación).
    <AdminLayout titulo="Reseñas">
      {/* ÁREA 1 · BUSCADOR y pestañas por estado (todas / por revisar / publicadas) con su contador. */}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <input
          type="search"
          className="h-[38px] w-[340px] rounded-[19px] bg-white px-4 font-texto text-[15px] shadow-[0_2px_8px_rgba(48,14,21,0.12)] max-[960px]:w-full"
          placeholder="Buscar por cliente, texto o producto"
          aria-label="Buscar reseña"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div className="flex flex-wrap gap-2.5" role="group" aria-label="Filtrar por estado">
          {pestanas.map((p) => (
            <button key={p.id} type="button" className={`${chipFiltro} px-3.5`} aria-pressed={pestana === p.id} onClick={() => setPestana(p.id)}>
              {p.texto} ({p.cantidad})
            </button>
          ))}
        </div>
      </div>

      {/* Estados de carga, error y vacío. */}
      {resenas.cargando && <Cargando />}
      {resenas.error && <MensajeError texto={resenas.error} reintentar={resenas.recargar} />}
      {resenas.datos && base.length === 0 && <Vacio texto={vacio} />}
      {base.length > 0 && lista.length === 0 && <Vacio texto="Ninguna reseña coincide con la búsqueda." />}

      {/* ÁREA 2 · TARJETAS DE RESEÑA: autor, estrellas, estado, productos, texto y acciones (aprobar/ocultar y eliminar). Solo las aprobadas se ven en el sitio. */}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4 max-[560px]:grid-cols-1">
        {lista.map((r) => (
          <li key={r.id} className={`${tarjetaCrema} flex flex-col gap-2.5 px-6 py-5`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-ui text-[15px] font-semibold text-tinto-texto">{r.nombre_cliente}</p>
              <p className="font-ui text-xs font-semibold text-dorado-texto">{formatoDia(r.fecha)}</p>
            </div>
            <div className="flex items-center justify-between gap-3">
              {r.calificacion ? <Estrellas valor={r.calificacion} tamano={16} /> : <span className="font-texto text-xs text-texto-secundario">Sin calificación</span>}
              <span
                className={`rounded-[9px] px-2.5 py-0.5 font-ui text-xs font-semibold ${r.aprobada ? 'bg-exito/15 text-exito' : 'bg-caramelo/40 text-dorado-texto'}`}
              >
                {r.aprobada ? 'Publicada' : 'Por revisar'}
              </span>
            </div>
            {r.productos.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Productos">
                {r.productos.map((p) => <li key={p.id} className={chipProducto}>{p.nombre}</li>)}
              </ul>
            )}
            <p className="flex-1 font-texto text-[15px] leading-normal whitespace-pre-line">{r.descripcion}</p>
            <p className="font-texto text-xs text-texto-secundario">
              {r.cita_id ? 'Escrita por el cliente desde su cuenta' : 'Capturada en el panel'}
            </p>
            <div className="flex items-center gap-2.5">
              <button type="button" className={botonPeligro} onClick={() => setBorrando(r)}>Eliminar</button>
              {r.aprobada ? (
                <button type="button" className="h-8 rounded-2xl border border-tinto-oscuro px-4 font-texto text-[15px] leading-none text-tinto-oscuro transition-colors enabled:hover:bg-tinto-oscuro/10 disabled:opacity-60" disabled={trabajando === r.id} onClick={() => moderar(r, false)}>
                  Ocultar
                </button>
              ) : (
                <button type="button" className={botonPildora} disabled={trabajando === r.id} onClick={() => moderar(r, true)}>
                  Aprobar y publicar
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {/* Confirmación antes de eliminar una reseña. */}
      {borrando && (
        <Confirmar
          titulo="Eliminar reseña"
          textoAccion="Sí, eliminar"
          onCerrar={() => setBorrando(null)}
          onConfirmar={() => eliminar(borrando)}
        >
          ¿Eliminar la reseña de <strong>{borrando.nombre_cliente}</strong>? Esta acción no se puede deshacer.
        </Confirmar>
      )}
    </AdminLayout>
  )
}
