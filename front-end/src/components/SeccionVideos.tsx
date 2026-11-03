import { useNegocio } from '../lib/negocio'
import { VideoTarjeta } from './Videos'

/* Sección de Inicio con los videos que el administrador marcó como "Sección de Inicio" (hasta 3).
   Si no hay ninguno, no se dibuja. */
export default function SeccionVideos() {
  const { videosDe } = useNegocio()
  const videos = videosDe('seccion_inicio').slice(0, 3)
  if (videos.length === 0) return null
  return (
    <section className="mx-auto mt-[88px] w-full max-w-[1440px] max-[760px]:mt-16" aria-labelledby="titulo-videos">
      <h2 id="titulo-videos" className="aparecer mb-10 text-center font-ui text-[52px] leading-[1.2] font-bold text-dorado max-[760px]:text-4xl">
        Nuestros postres en video
      </h2>
      <div className={`mx-auto grid gap-6 max-[1000px]:grid-cols-1 ${videos.length === 1 ? 'max-w-[860px] grid-cols-1' : videos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {videos.map((v) => (
          <div key={v.url} className="aparecer">
            <VideoTarjeta url={v.url} titulo={v.titulo} />
          </div>
        ))}
      </div>
    </section>
  )
}
