import { RotateCw } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { botonOscuro, botonPildora } from '../lib/estilos'
import Modal from './Modal'

/* EDITOR DE IMAGEN (recorte): se abre al elegir una foto en <SubirImagen>.
   Se arrastra la foto para encuadrarla, se acerca con el control de zoom, se gira de 90° en 90°
   y se elige la proporción del recorte. Al aplicar entrega un archivo nuevo ya recortado. */

const PROPORCIONES: { texto: string; valor: number | null }[] = [
  { texto: 'Original', valor: null },
  { texto: '1:1', valor: 1 },
  { texto: '4:3', valor: 4 / 3 },
  { texto: '3:4', valor: 3 / 4 },
  { texto: '16:9', valor: 16 / 9 },
  { texto: '2:1', valor: 2 },
]
const ALTO_MAXIMO = 340 // px del marco en pantalla
const LADO_MAXIMO = 2000 // px del archivo resultante

const cargar = (url: string) =>
  new Promise<HTMLImageElement>((ok, mal) => {
    const img = new Image()
    img.onload = () => ok(img)
    img.onerror = () => mal(new Error('No se pudo leer la imagen'))
    img.src = url
  })

const aBlob = (c: HTMLCanvasElement, tipo: string, calidad?: number) =>
  new Promise<Blob | null>((ok) => c.toBlob(ok, tipo, calidad))

interface Props {
  archivo: File
  proporcion?: number // proporción sugerida (ancho / alto); sin ella se parte de la original
  onListo: (archivo: File) => void
  onSinRecortar: () => void
  onCancelar: () => void
}

export default function EditorImagen({ archivo, proporcion, onListo, onSinRecortar, onCancelar }: Props) {
  // `fuente` es la foto (ya girada si hace falta); se vuelve a dibujar al rotar
  const [fuente, setFuente] = useState<HTMLCanvasElement | HTMLImageElement | null>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [aspecto, setAspecto] = useState<number | null>(proporcion ?? null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 }) // desplazamiento de la foto respecto al centro del marco
  const [marco, setMarco] = useState({ w: 0, h: 0 })
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const marcoRef = useRef<HTMLDivElement>(null)
  const arrastre = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  useEffect(() => {
    const u = URL.createObjectURL(archivo)
    let vivo = true
    cargar(u)
      .then((img) => { if (vivo) { setFuente(img); setUrl(u) } })
      .catch((e: Error) => { if (vivo) setError(e.message) })
    return () => { vivo = false; URL.revokeObjectURL(u) }
  }, [archivo])

  const anchoFuente = fuente ? ('naturalWidth' in fuente ? fuente.naturalWidth : fuente.width) : 0
  const altoFuente = fuente ? ('naturalHeight' in fuente ? fuente.naturalHeight : fuente.height) : 0
  const asp = aspecto ?? (anchoFuente && altoFuente ? anchoFuente / altoFuente : 1)

  // Mide el marco (su tamaño depende de la proporción y del ancho disponible)
  useLayoutEffect(() => {
    const el = marcoRef.current
    if (!el) return
    const medir = () => setMarco({ w: el.clientWidth, h: el.clientHeight })
    medir()
    const o = new ResizeObserver(medir)
    o.observe(el)
    return () => o.disconnect()
  }, [fuente, asp])

  // Escala base: la foto cubre justo el marco; el zoom la agranda desde ahí
  const base = anchoFuente && marco.w ? Math.max(marco.w / anchoFuente, marco.h / altoFuente) : 1
  const escala = base * zoom
  const dw = anchoFuente * escala
  const dh = altoFuente * escala
  const tope = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v))
  const px = tope(pos.x, Math.max(0, (dw - marco.w) / 2))
  const py = tope(pos.y, Math.max(0, (dh - marco.h) / 2))

  const rotar = () => {
    if (!fuente) return
    const c = document.createElement('canvas')
    c.width = altoFuente
    c.height = anchoFuente
    const g = c.getContext('2d')!
    g.translate(c.width / 2, c.height / 2)
    g.rotate(Math.PI / 2)
    g.drawImage(fuente, -anchoFuente / 2, -altoFuente / 2)
    setFuente(c)
    setUrl(c.toDataURL('image/png'))
    setPos({ x: 0, y: 0 })
  }

  const aplicar = async () => {
    if (!fuente) return
    setGuardando(true)
    setError(null)
    try {
      // Zona de la foto original que queda dentro del marco
      const ancho = marco.w / escala
      const alto = marco.h / escala
      const sx = anchoFuente / 2 - px / escala - ancho / 2
      const sy = altoFuente / 2 - py / escala - alto / 2
      const reduccion = Math.min(1, LADO_MAXIMO / Math.max(ancho, alto))
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(ancho * reduccion))
      c.height = Math.max(1, Math.round(alto * reduccion))
      c.getContext('2d')!.drawImage(fuente, sx, sy, ancho, alto, 0, 0, c.width, c.height)
      // JPG se queda en JPG; los demás en PNG o WEBP para conservar la transparencia
      const jpg = archivo.type === 'image/jpeg'
      const tipo = jpg ? 'image/jpeg' : archivo.type === 'image/webp' || archivo.type === 'image/avif' ? 'image/webp' : 'image/png'
      const blob = await aBlob(c, tipo, 0.92)
      if (!blob) throw new Error('No se pudo recortar la imagen')
      const ext = tipo.split('/')[1].replace('jpeg', 'jpg')
      const nombre = archivo.name.replace(/\.[^.]+$/, '') || 'imagen'
      onListo(new File([blob], `${nombre}.${ext}`, { type: tipo }))
    } catch (e) {
      setError((e as Error).message)
      setGuardando(false)
    }
  }

  const alMover = (e: React.PointerEvent) => {
    const a = arrastre.current
    if (!a) return
    setPos({ x: a.px + e.clientX - a.x, y: a.py + e.clientY - a.y })
  }

  return createPortal(
    <Modal titulo="Ajustar imagen" onCerrar={onCancelar} cerrarAlFondo={false}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Proporción del recorte">
          {PROPORCIONES.map((p) => (
            <button
              key={p.texto}
              type="button"
              className="h-8 rounded-lg border border-tinto-texto/30 bg-white px-3 font-ui text-[13px] font-semibold text-tinto-texto hover:bg-tinto/10 aria-pressed:border-tinto aria-pressed:bg-tinto aria-pressed:text-white"
              aria-pressed={aspecto === p.valor}
              onClick={() => { setAspecto(p.valor); setPos({ x: 0, y: 0 }) }}
            >
              {p.texto}
            </button>
          ))}
        </div>

        <div className="flex justify-center rounded-xl bg-tinto-oscuro/90 p-3">
          <div
            ref={marcoRef}
            className="relative touch-none overflow-hidden rounded-md bg-black/40 outline-2 outline-white/70 select-none"
            style={{ aspectRatio: String(asp), width: `min(100%, ${ALTO_MAXIMO * asp}px)` }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId)
              arrastre.current = { x: e.clientX, y: e.clientY, px, py }
            }}
            onPointerMove={alMover}
            onPointerUp={() => { arrastre.current = null }}
            onPointerCancel={() => { arrastre.current = null }}
            onWheel={(e) => setZoom((z) => Math.max(1, Math.min(4, z - e.deltaY * 0.002)))}
          >
            {url && (
              <img
                src={url}
                alt="Imagen por recortar"
                draggable={false}
                className="pointer-events-none absolute top-1/2 left-1/2 max-w-none cursor-grab"
                style={{ width: dw, height: dh, transform: `translate(calc(-50% + ${px}px), calc(-50% + ${py}px))` }}
              />
            )}
            {!url && !error && <p className="absolute inset-0 grid place-items-center font-texto text-sm text-white">Cargando…</p>}
          </div>
        </div>
        <p className="text-center font-texto text-xs text-texto-secundario">Arrastra la foto para encuadrarla. Todo lo que queda fuera del marco se recorta.</p>

        <div className="flex items-center gap-3">
          <label className="flex flex-1 items-center gap-3 font-ui text-[13px] font-semibold text-tinto-texto">
            Zoom
            <input
              type="range" min={1} max={4} step={0.01} value={zoom}
              className="flex-1 accent-tinto"
              aria-label="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg border border-tinto-texto/30 bg-white text-tinto-texto hover:bg-tinto/10"
            aria-label="Girar 90 grados"
            title="Girar 90°"
            onClick={rotar}
          >
            <RotateCw size={18} />
          </button>
        </div>

        {error && <p className="font-ui text-xs font-semibold text-error" role="alert">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-1">
          <button type="button" className="font-ui text-sm font-semibold text-dorado-texto hover:underline" onClick={onSinRecortar} disabled={guardando}>
            Usar sin recortar
          </button>
          <button type="button" className={`${botonPildora} bg-transparent text-tinto-texto! enabled:hover:bg-tinto/10`} onClick={onCancelar} disabled={guardando}>
            Cancelar
          </button>
          <button type="button" className={`${botonOscuro} px-6`} onClick={aplicar} disabled={!fuente || guardando}>
            {guardando ? 'Aplicando…' : 'Aplicar'}
          </button>
        </div>
      </div>
    </Modal>,
    document.body,
  )
}
