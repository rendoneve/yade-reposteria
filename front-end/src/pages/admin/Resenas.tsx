import { useState } from 'react'
import AdminLayout from '../../components/AdminLayout'
import Confirmar from '../../components/Confirmar'
import { Cargando, MensajeError, Vacio } from '../../components/Estado'
import { api, formatoDia, type Resena } from '../../lib/api'
import { avisar } from '../../lib/avisos'
import { botonPeligro, chipProducto, tarjetaCrema } from '../../lib/estilos'
import { useDatos } from '../../lib/useDatos'

const cargarResenas = () => api<Resena[]>('/resenas', { params: { limit: 200 } })

/* ADMINISTRADOR reseñas: lo que publican los clientes sobre sus citas terminadas.
   El administrador puede quitar las que no deban mostrarse en el sitio. */
export default function Resenas() {
  const resenas = useDatos('resenas:admin', cargarResenas)
  const [borrando, setBorrando] = useState<Resena | null>(null)
  const [texto, setTexto] = useState('')

  const filtro = texto.trim().toLowerCase()
  const lista = (resenas.datos ?? []).filter(
    (r) =>
      !filtro ||
      r.nombre_cliente.toLowerCase().includes(filtro) ||
      r.descripcion.toLowerCase().includes(filtro) ||
      r.productos.some((p) => p.nombre.toLowerCase().includes(filtro)),
  )

  const eliminar = async (r: Resena) => {
    await api(`/resenas/${r.id}`, { method: 'DELETE' })
    setBorrando(null)
    avisar(`Reseña de ${r.nombre_cliente} eliminada`)
    resenas.recargar()
  }

  return (
    <AdminLayout titulo="Reseñas">
      <input
        type="search"
        className="mb-6 h-[38px] w-[340px] rounded-[19px] bg-white px-4 font-texto text-[15px] shadow-[0_2px_8px_rgba(48,14,21,0.12)] max-[960px]:w-full"
        placeholder="Buscar por cliente, texto o producto"
        aria-label="Buscar reseña"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      {resenas.cargando && <Cargando />}
      {resenas.error && <MensajeError texto={resenas.error} reintentar={resenas.recargar} />}
      {resenas.datos?.length === 0 && <Vacio texto="Todavía no hay reseñas. Aparecerán cuando los clientes reseñen sus citas terminadas." />}
      {resenas.datos && resenas.datos.length > 0 && lista.length === 0 && <Vacio texto="Ninguna reseña coincide con la búsqueda." />}
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4 max-[560px]:grid-cols-1">
        {lista.map((r) => (
          <li key={r.id} className={`${tarjetaCrema} flex flex-col gap-2.5 px-6 py-5`}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-ui text-[15px] font-semibold text-tinto-texto">{r.nombre_cliente}</p>
              <p className="font-ui text-xs font-semibold text-dorado-texto">{formatoDia(r.fecha)}</p>
            </div>
            {r.productos.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Productos">
                {r.productos.map((p) => <li key={p.id} className={chipProducto}>{p.nombre}</li>)}
              </ul>
            )}
            <p className="flex-1 font-texto text-[15px] leading-normal whitespace-pre-line">{r.descripcion}</p>
            <p className="font-texto text-xs text-texto-secundario">
              {r.cita_id ? 'Publicada por el cliente desde su cuenta' : 'Capturada en el panel'}
            </p>
            <button type="button" className={`${botonPeligro} mr-0 self-end`} onClick={() => setBorrando(r)}>Eliminar</button>
          </li>
        ))}
      </ul>
      {borrando && (
        <Confirmar
          titulo="Eliminar reseña"
          textoAccion="Sí, eliminar"
          onCerrar={() => setBorrando(null)}
          onConfirmar={() => eliminar(borrando)}
        >
          ¿Eliminar la reseña de <strong>{borrando.nombre_cliente}</strong>? Ya no se mostrará en el sitio.
        </Confirmar>
      )}
    </AdminLayout>
  )
}
