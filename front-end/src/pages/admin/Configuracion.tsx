import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import AdminLayout from '../../components/AdminLayout'
import { Cargando, MensajeError } from '../../components/Estado'
import SubirImagen from '../../components/SubirImagen'
import { api, resolverImagen, type CambioImagen, type Horario, type Negocio } from '../../lib/api'
import { botonOscuro, campoAdmin, controlAdmin, errorAdmin, tarjetaCrema, tituloTarjetaAdmin } from '../../lib/estilos'
import { CATALOGO_TEXTO_POR_DEFECTO, HERO_TEXTO_POR_DEFECTO, NOMBRE_POR_DEFECTO, useNegocio } from '../../lib/negocio'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0] // lunes primero

type FilaHorario = { dia_semana: number; abre: string; cierra: string; cerrado: boolean }

const hora = (h: string | null) => (h ? h.slice(0, 5) : '')
const textoONull = (v: FormDataEntryValue | null) => String(v ?? '').trim() || null
// "HH:MM" se compara bien como texto
const horasInvalidas = (h: FilaHorario) => !h.cerrado && !!h.abre && !!h.cierra && h.abre >= h.cierra

function filasDe(horarios: Horario[]): FilaHorario[] {
  return ORDEN_DIAS.map((d) => {
    const h = horarios.find((x) => x.dia_semana === d)
    return { dia_semana: d, abre: hora(h?.abre ?? null), cierra: hora(h?.cierra ?? null), cerrado: h?.cerrado ?? true }
  })
}

const tarjeta = `${tarjetaCrema} mb-6 flex flex-col gap-[13px] px-7 pt-[22px] pb-[26px] max-[960px]:px-4`
const ayuda = 'font-texto text-xs leading-[1.3] font-normal text-texto-secundario'

/* ADMINISTRADOR configuración: información del negocio que se muestra en el sitio
   (no está en Figma; usa los estilos del panel). */
export default function Configuracion() {
  const { negocio, error, cargando, recargar } = useNegocio()

  return (
    <AdminLayout titulo="Configuración">
      {cargando && !negocio && <Cargando />}
      {error && !negocio && <MensajeError texto={error} reintentar={recargar} />}
      {negocio && <FormNegocio negocio={negocio} />}
    </AdminLayout>
  )
}

// Formulario único: sube las imágenes nuevas, guarda horarios y luego los datos del negocio; al terminar actualiza el sitio sin recargar.
function FormNegocio({ negocio }: { negocio: Negocio }) {
  const { actualizar } = useNegocio()
  const [logo, setLogo] = useState<CambioImagen>()
  const [hero, setHero] = useState<CambioImagen>()
  const [banner, setBanner] = useState<CambioImagen>()
  const [catalogo, setCatalogo] = useState<CambioImagen>()
  const [horarios, setHorarios] = useState(() => filasDe(negocio.horarios))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  useEffect(() => {
    if (!guardado) return
    const t = setTimeout(() => setGuardado(false), 4000)
    return () => clearTimeout(t)
  }, [guardado])

  const cambiarDia = (dia: number, cambio: Partial<FilaHorario>) =>
    setHorarios((hs) => hs.map((h) => (h.dia_semana === dia ? { ...h, ...cambio } : h)))

  const guardar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setGuardando(true)
    setError(null)
    setGuardado(false)
    const mal = horarios.filter(horasInvalidas).map((h) => DIAS[h.dia_semana])
    if (mal.length) {
      setError(`${mal.join(', ')}: la hora de apertura debe ser antes que la de cierre (revisa a.m. / p.m.).`)
      setGuardando(false)
      return
    }
    try {
      const [logo_url, hero_url, banner_url, catalogo_url] = await Promise.all([
        resolverImagen(logo, negocio.logo_url),
        resolverImagen(hero, negocio.hero_url),
        resolverImagen(banner, negocio.banner_url),
        resolverImagen(catalogo, negocio.catalogo_url),
      ])
      const nuevosHorarios = await api<Horario[]>('/horarios', {
        method: 'PUT',
        body: horarios.map((h) => (h.cerrado ? { dia_semana: h.dia_semana, cerrado: true } : { dia_semana: h.dia_semana, abre: h.abre, cierra: h.cierra })),
      })
      const nuevo = await api<Negocio>('/negocio', {
        method: 'PATCH',
        body: {
          nombre: textoONull(f.get('nombre')),
          logo_url,
          hero_url,
          banner_url,
          catalogo_url,
          texto_principal: textoONull(f.get('texto_principal')),
          texto_catalogo: textoONull(f.get('texto_catalogo')),
          texto_acerca: textoONull(f.get('texto_acerca')),
          whatsapp: textoONull(f.get('whatsapp'))?.replace(/[\s()-]/g, '') ?? null,
          ubicacion: textoONull(f.get('ubicacion')),
          mapa_url: textoONull(f.get('mapa_url')),
        },
      })
      actualizar({ ...nuevo, horarios: nuevosHorarios })
      // Las imágenes ya quedaron en `negocio`; lo pendiente se limpia
      setLogo(undefined)
      setHero(undefined)
      setBanner(undefined)
      setCatalogo(undefined)
      setGuardado(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    // FORMULARIO DE CONFIGURACIÓN: cada tarjeta controla una parte del sitio público.
    <form onSubmit={guardar}>
      <div className="grid grid-cols-2 gap-x-6 max-[1200px]:grid-cols-1">
        {/* TARJETA IDENTIDAD: nombre y logo (encabezado y pie de todo el sitio). */}
        <Seccion titulo="Identidad">
          <label className={campoAdmin}>
            Nombre del negocio
            <input className={controlAdmin} name="nombre" maxLength={100} defaultValue={negocio.nombre ?? ''} placeholder={NOMBRE_POR_DEFECTO} />
          </label>
          <div className={campoAdmin}>
            Logo
            <SubirImagen imagenInicial={negocio.logo_url} onChange={setLogo} className="h-36" fondoOscuro />
            <span className={ayuda}>Se ve sobre fondo oscuro (encabezado y pie). Sin logo se usa el de Yade.</span>
          </div>
        </Seccion>

        {/* TARJETA HERO DE INICIO: texto e imagen de la portada. */}
        <Seccion titulo="Hero de inicio">
          <label className={campoAdmin}>
            Texto
            <textarea className={controlAdmin} name="texto_principal" rows={3} defaultValue={negocio.texto_principal ?? ''} placeholder={HERO_TEXTO_POR_DEFECTO} />
            <span className={ayuda}>Cada renglón es una línea del título; el primero se ve un poco más chico.</span>
          </label>
          <div className={campoAdmin}>
            Imagen
            <SubirImagen imagenInicial={negocio.hero_url} onChange={setHero} className="h-36" fondoOscuro />
            <span className={ayuda}>De preferencia PNG con fondo transparente. Sin imagen se usa la del diseño.</span>
          </div>
        </Seccion>

        {/* TARJETA HERO DEL MENÚ: título e imagen de la página Menú. */}
        <Seccion titulo="Hero del menú">
          <label className={campoAdmin}>
            Texto
            <textarea className={controlAdmin} name="texto_catalogo" rows={2} defaultValue={negocio.texto_catalogo ?? ''} placeholder={CATALOGO_TEXTO_POR_DEFECTO} />
            <span className={ayuda}>Título de la página Menú. Cada renglón es una línea; el primero se ve un poco más chico.</span>
          </label>
          <div className={campoAdmin}>
            Imagen
            <SubirImagen imagenInicial={negocio.catalogo_url} onChange={setCatalogo} className="h-36" fondoOscuro />
            <span className={ayuda}>Con imagen propia se muestra a todo lo ancho, con un degradado para que se lea el texto. Sin imagen se usa la del diseño.</span>
          </div>
        </Seccion>

        {/* TARJETA ACERCA DE: historia del negocio y banner. */}
        <Seccion titulo="Acerca de">
          <label className={campoAdmin}>
            Historia del negocio
            <textarea className={controlAdmin} name="texto_acerca" rows={8} defaultValue={negocio.texto_acerca ?? ''} />
          </label>
          <div className={campoAdmin}>
            Banner
            <SubirImagen imagenInicial={negocio.banner_url} onChange={setBanner} className="h-36" />
            <span className={ayuda}>Foto horizontal de fondo para el título de "Acerca de". Se oscurece para que se lea el texto.</span>
          </div>
        </Seccion>

        {/* TARJETA CONTACTO: WhatsApp (botones de contacto), ubicación y mapa. */}
        <Seccion titulo="Contacto">
          <label className={campoAdmin}>
            WhatsApp
            <input className={controlAdmin} name="whatsapp" type="tel" inputMode="tel" pattern="\+?[0-9\s()\-]{10,20}" defaultValue={negocio.whatsapp ?? ''} placeholder="5216681234567" />
            <span className={ayuda}>Con código de país, solo números (52 + 1 + número para México).</span>
          </label>
          <label className={campoAdmin}>
            Ubicación
            <input className={controlAdmin} name="ubicacion" maxLength={255} defaultValue={negocio.ubicacion ?? ''} />
          </label>
          <label className={campoAdmin}>
            Enlace de Google Maps (opcional)
            <input className={controlAdmin} name="mapa_url" type="url" maxLength={500} defaultValue={negocio.mapa_url ?? ''} />
          </label>
        </Seccion>
      </div>

      {/* TARJETA HORARIOS: días abiertos y horas. De aquí salen la agenda de citas y el "abierto ahora" del inicio. */}
      <Seccion titulo="Horarios">
        <ul className="flex flex-col">
          {horarios.map((h) => (
            <li key={h.dia_semana} className="grid grid-cols-[120px_120px_1fr] items-center gap-[13px] border-b border-tinto-texto/20 py-2 max-[560px]:grid-cols-2">
              <span className="font-ui text-[15px] font-semibold text-tinto-texto">{DIAS[h.dia_semana]}</span>
              <label className="flex items-center gap-2 font-texto text-[15px] text-tinto-texto">
                <input type="checkbox" className="size-4 accent-tinto" checked={!h.cerrado} onChange={(e) => cambiarDia(h.dia_semana, { cerrado: !e.target.checked })} />
                Abierto
              </label>
              {h.cerrado ? (
                <span className="font-texto text-[15px] text-texto-secundario max-[560px]:col-span-2">Cerrado</span>
              ) : (
                <div className="flex items-center gap-2 font-texto text-[15px] max-[560px]:col-span-2">
                  <input className={`${controlAdmin} aria-invalid:border-2 aria-invalid:border-error`} type="time" required aria-invalid={horasInvalidas(h) || undefined} aria-label={`${DIAS[h.dia_semana]}: abre`} value={h.abre} onChange={(e) => cambiarDia(h.dia_semana, { abre: e.target.value })} />
                  <span>a</span>
                  <input className={`${controlAdmin} aria-invalid:border-2 aria-invalid:border-error`} type="time" required aria-invalid={horasInvalidas(h) || undefined} aria-label={`${DIAS[h.dia_semana]}: cierra`} value={h.cierra} onChange={(e) => cambiarDia(h.dia_semana, { cierra: e.target.value })} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </Seccion>

      {/* BARRA DE GUARDADO fija abajo: error, confirmación y botón. */}
      <div className="sticky bottom-0 z-1 -mx-2 flex items-center justify-end gap-4 bg-beige/95 px-2 py-3">
        {error && <p className={errorAdmin} role="alert">{error}</p>}
        {guardado && <p className="font-ui text-[13px] font-semibold text-exito" role="status">Cambios guardados</p>}
        <button className={`${botonOscuro} px-6`} type="submit" disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

// Tarjeta con título que agrupa campos.
function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className={tarjeta}>
      <h2 className={tituloTarjetaAdmin}>{titulo}</h2>
      {children}
    </section>
  )
}
