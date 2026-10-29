import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/* Ventana modal con <dialog> nativo (Esc la cierra).
   Un clic fuera la cierra solo si no se ha escrito nada: así no se pierde un formulario a medias.
   El reset de Tailwind le quita al <dialog> el margin:auto que lo centra: por eso lleva m-auto. */
export default function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  const modificado = useRef(false)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      // .modal (index.css): entra con animación y difumina el fondo
      className="modal m-auto max-h-[calc(100dvh-32px)] w-[min(540px,calc(100%-32px))] overflow-y-auto rounded-[18px] bg-crema p-0 shadow-modal"
      onClose={onCerrar}
      onInput={() => { modificado.current = true }}
      onClick={(e) => { if (e.target === ref.current && !modificado.current) ref.current?.close() }}
    >
      <div className="px-7 py-6 max-[560px]:px-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="font-titulo text-[30px] leading-[1.1] font-bold text-tinto-texto">{titulo}</h2>
          <button
            type="button"
            className="grid size-9 flex-none place-items-center rounded-full text-tinto-texto transition-colors hover:bg-tinto-texto/10"
            aria-label="Cerrar"
            onClick={() => ref.current?.close()}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
