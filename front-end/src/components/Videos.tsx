import { useEffect, useRef } from 'react'

/* Videos del sitio (se suben y se ubican en Panel → Configuración → Videos). */

/* Video de fondo de un hero: sin sonido, en bucle y a todo lo ancho (como una foto). */
export function VideoFondo({ url }: { url: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  // El navegador puede pausar un video que sale de pantalla (al bajar) o de una pestaña oculta:
  // se vuelve a reproducir en cuanto se pausa solo, para que el bucle nunca se detenga.
  useEffect(() => {
    const v = ref.current
    if (!v) return
    const seguir = () => { if (!document.hidden) void v.play().catch(() => undefined) }
    v.addEventListener('pause', seguir)
    v.addEventListener('ended', seguir)
    document.addEventListener('visibilitychange', seguir)
    seguir()
    return () => {
      v.removeEventListener('pause', seguir)
      v.removeEventListener('ended', seguir)
      document.removeEventListener('visibilitychange', seguir)
    }
  }, [url])
  return (
    <video
      ref={ref}
      className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
      src={url}
      autoPlay
      muted
      loop
      playsInline
      preload="auto"
      aria-hidden="true"
    />
  )
}

/* Video dentro de la página, con controles (el visitante decide si lo reproduce y con sonido). */
export function VideoTarjeta({ url, titulo }: { url: string; titulo?: string | null }) {
  return (
    <figure className="overflow-hidden rounded-[18px] bg-tinto-oscuro shadow-tarjeta">
      <video className="aspect-video w-full bg-black object-contain" src={url} controls playsInline preload="metadata" />
      {titulo && <figcaption className="px-5 py-3 font-ui text-[15px] font-semibold text-beige">{titulo}</figcaption>}
    </figure>
  )
}
