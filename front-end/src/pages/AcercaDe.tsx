import Encabezado from '../components/Encabezado'
import { Cargando, MensajeError } from '../components/Estado'
import Pie from '../components/Pie'
import { api } from '../lib/api'
import { useDatos } from '../lib/useDatos'

type Horario = { dia_semana: number; dia: string; abre: string | null; cierra: string | null; cerrado: boolean }
type Negocio = {
  texto_acerca: string | null
  whatsapp: string | null
  ubicacion: string | null
  mapa_url: string | null
  horarios: Horario[]
}

const hora = (h: string | null) => (h ? h.slice(0, 5) : '')

/* ACERCA DE (Figma 20:112). En el diseño solo están el hero, el encabezado y el pie;
   el contenido sale de servicio-negocio. */
export default function AcercaDe() {
  const { datos, error, cargando, recargar } = useDatos(() => api<Negocio>('/negocio'))
  // Lunes primero
  const horarios = datos ? [...datos.horarios].sort((a, b) => ((a.dia_semana + 6) % 7) - ((b.dia_semana + 6) % 7)) : []

  return (
    <div className="pagina">
      <section className="hero hero--acerca">
        <Encabezado />
        <h1 className="hero__titulo hero__titulo--acerca">
          <span className="hero__linea hero__linea--chica">Conoce a</span>
          <span className="hero__linea">YADE BAKERY</span>
        </h1>
      </section>
      <main className="acerca">
        {cargando && <Cargando />}
        {error && <MensajeError texto={error} reintentar={recargar} />}
        {datos && (
          <div className="acerca__grid">
            <section className="acerca__bloque">
              <h2 className="acerca__titulo">Nuestra historia</h2>
              <p className="acerca__texto">
                {datos.texto_acerca || 'Muy pronto te contaremos nuestra historia.'}
              </p>
            </section>
            <section className="acerca__bloque">
              <h2 className="acerca__titulo">Visítanos</h2>
              {datos.ubicacion && <p className="acerca__texto">{datos.ubicacion}</p>}
              {datos.mapa_url && (
                <a className="acerca__enlace" href={datos.mapa_url} target="_blank" rel="noreferrer">Ver en el mapa →</a>
              )}
              {datos.whatsapp && (
                <a className="acerca__enlace" href={`https://wa.me/${datos.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  Escríbenos por WhatsApp →
                </a>
              )}
              <h3 className="acerca__subtitulo">Horarios</h3>
              <ul className="acerca__horarios">
                {horarios.map((h) => (
                  <li key={h.dia_semana}>
                    <span>{h.dia}</span>
                    <span>{h.cerrado ? 'Cerrado' : `${hora(h.abre)} – ${hora(h.cierra)}`}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </main>
      <Pie />
    </div>
  )
}
