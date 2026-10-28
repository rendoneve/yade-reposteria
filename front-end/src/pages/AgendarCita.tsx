import { useState, type FormEvent } from 'react'
import Encabezado from '../components/Encabezado'
import Pie from '../components/Pie'
import { X } from 'lucide-react'
import { api, ETIQUETA_SERVICIO, formatoFecha, type Categoria, type Producto } from '../lib/api'
import { useSesion } from '../lib/auth'
import {
  botonOscuro,
  campoPublico,
  chipProducto,
  controlPublico,
  degradadoHero,
  enlaceDorado,
  hero,
  heroLinea,
  heroTitulo,
  pagina,
  tarjetaCrema,
} from '../lib/estilos'
import { Link, useRuta } from '../lib/router'
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
  const { usuario } = useSesion()
  const idProducto = Number(query.get('producto')) || null
  const producto = useDatos(
    () => (idProducto ? api<Producto>(`/productos/${idProducto}`) : Promise.resolve(null)),
    [idProducto],
  )
  const categorias = useDatos(() => api<Categoria[]>('/categorias'))
  const catalogo = useDatos(() => api<Producto[]>('/productos', { params: { limit: 500 } }))
  // Productos que se piden en la cita (quedan ligados a ella y, después, a la reseña)
  const [elegidos, setElegidos] = useState<number[]>(() => (idProducto ? [idProducto] : []))

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
          tipo_servicio: String(f.get('tipo')),
          detalles: String(f.get('detalles')).trim() || null,
          producto_ids: elegidos,
        },
      })
      setConfirmada(r)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  const nombreProducto = (id: number) =>
    catalogo.datos?.find((p) => p.id === id)?.nombre ?? (producto.datos?.id === id ? producto.datos.nombre : `Producto ${id}`)
  const disponibles = (catalogo.datos ?? [])
    .filter((p) => !elegidos.includes(p.id))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  const entrarYVolver = `/entrar?siguiente=${encodeURIComponent(location.pathname + location.search)}`
  // Una categoría que se llame igual que un servicio ("Pasteles") se muestra una sola vez
  const servicioDe = (nombre: string) =>
    Object.keys(ETIQUETA_SERVICIO).find((k) => ETIQUETA_SERVICIO[k].toLowerCase() === nombre.trim().toLowerCase())
  const categoriasExtra = (categorias.datos ?? []).filter((c) => !servicioDe(c.nombre))
  const nombreCategoria = producto.datos?.categoria_nombre
  const tipoInicial = nombreCategoria ? (servicioDe(nombreCategoria) ?? nombreCategoria) : 'pasteles'

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
            {usuario ? (
              <p className="font-texto text-base leading-normal">
                Puedes verla o cancelarla en <Link to="/cuenta/citas" className={`${enlaceDorado} text-base`}>Mis citas</Link>.
              </p>
            ) : (
              <p className="font-texto text-base leading-normal text-texto-secundario">
                ¿Quieres seguir tus citas y dejar reseñas? <Link to="/registro" className={`${enlaceDorado} text-base`}>Crea una cuenta</Link> antes de agendar la próxima.
              </p>
            )}
          </div>
        ) : (
          <form className={tarjetaForm} onSubmit={enviar} key={`${tipoInicial}|${categoriasExtra.length}|${usuario?.id}`}>
            {!usuario && (
              <p className="font-texto text-[15px] leading-normal text-texto-secundario">
                ¿Tienes cuenta? <Link to={entrarYVolver} className={`${enlaceDorado} text-[15px]`}>Inicia sesión</Link> para
                ver esta cita en tu panel, cancelarla y dejar tu reseña cuando termine.
              </p>
            )}
            <label className={campoPublico}>
              Fecha y hora
              <input className={controlPublico} name="fecha" type="datetime-local" required defaultValue={mananaALas(11)} />
            </label>
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
                  <option key={p.id} value={p.id}>{p.nombre}{p.categoria_nombre ? ` · ${p.categoria_nombre}` : ''}</option>
                ))}
              </select>
            </fieldset>
            <label className={campoPublico}>
              Detalles
              <textarea className={controlPublico} name="detalles" rows={4} maxLength={2000} />
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
