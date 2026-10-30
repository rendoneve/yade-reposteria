import Encabezado from '../components/Encabezado'
import { Cargando, MensajeError } from '../components/Estado'
import Pie from '../components/Pie'
import { degradadoHero, hero, heroLinea, heroLineaChica, heroTitulo, pagina, tarjetaCrema } from '../lib/estilos'
import { useNegocio } from '../lib/negocio'

const bloque = `${tarjetaCrema} aparecer flex flex-col gap-3 px-8 py-[30px]`
const texto = 'font-texto text-lg leading-[1.55] whitespace-pre-line'

// Convierte "HH:MM:SS" del servidor a "HH:MM".
const hora = (h: string | null) => (h ? h.slice(0, 5) : '')

/* ACERCA DE (Figma 20:112). En el diseño solo están el hero, el encabezado y el pie;
   el contenido (y el banner del hero) sale de servicio-negocio. */
export default function AcercaDe() {
  const { negocio: datos, error, cargando, recargar, nombre, banner } = useNegocio()
  // Lunes primero
  const horarios = datos ? [...datos.horarios].sort((a, b) => ((a.dia_semana + 6) % 7) - ((b.dia_semana + 6) % 7)) : []

  return (
    <div className={pagina}>
      {/* ÁREA 1 · HERO: banner del negocio de fondo (si hay) y título "Conoce a <nombre>". */}
      <section
        className={`${hero} h-[400px] ${banner ? 'bg-cover bg-center' : degradadoHero}`}
        style={banner ? { backgroundImage: `linear-gradient(180deg, rgba(48,14,21,0.45) 0%, #300e15 100%), url("${banner}")` } : undefined}
      >
        <Encabezado />
        <h1 className={`${heroTitulo} top-[130px] h-[200px]`}>
          <span className={heroLineaChica}>Conoce a</span>
          <span className={heroLinea}>{nombre.toUpperCase()}</span>
        </h1>
      </section>
      {/* ÁREA 2 · CONTENIDO: se carga desde servicio-negocio (con estados de carga y error). */}
      <main className="flex-1 px-margen pt-[60px] pb-[100px] max-[760px]:px-4 max-[760px]:pt-10 max-[760px]:pb-20">
        {cargando && <Cargando />}
        {error && <MensajeError texto={error} reintentar={recargar} />}
        {datos && (
          <div className="grid grid-cols-[1.4fr_1fr] gap-8 max-[1280px]:grid-cols-1">
            {/* Tarjeta "Nuestra historia": texto libre editable en Configuración > Acerca de. */}
            <section className={bloque}>
              <h2 className="font-titulo text-4xl leading-[1.1] font-bold text-dorado">Nuestra historia</h2>
              <p className={texto}>
                {datos.texto_acerca || 'Muy pronto te contaremos nuestra historia.'}
              </p>
            </section>
            {/* Tarjeta "Visítanos": ubicación, enlace al mapa, WhatsApp y tabla de horarios (lunes primero). */}
            <section className={bloque}>
              <h2 className="font-titulo text-4xl leading-[1.1] font-bold text-dorado">Visítanos</h2>
              {datos.ubicacion && <p className={texto}>{datos.ubicacion}</p>}
              {datos.mapa_url && (
                <a className="font-ui text-base leading-[1.4] font-semibold text-dorado-texto hover:underline" href={datos.mapa_url} target="_blank" rel="noreferrer">Ver en el mapa →</a>
              )}
              {datos.whatsapp && (
                <a className="font-ui text-base leading-[1.4] font-semibold text-dorado-texto hover:underline" href={`https://wa.me/${datos.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  Escríbenos por WhatsApp →
                </a>
              )}
              <h3 className="mt-3 font-titulo text-[26px] leading-[1.2] font-bold text-tinto-texto">Horarios</h3>
              <ul className="font-texto text-base leading-[1.4]">
                {horarios.map((h) => (
                  <li key={h.dia_semana} className="flex justify-between border-b border-tinto-texto/15 py-[7px]">
                    <span>{h.dia}</span>
                    <span>{h.cerrado ? 'Cerrado' : `${hora(h.abre)} – ${hora(h.cierra)}`}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
      {/* ÁREA 3 · PIE compartido. */}
      <Pie />
    </div>
  )
}
