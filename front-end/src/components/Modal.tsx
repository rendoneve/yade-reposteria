import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

/* Ventana modal con <dialog> nativo (Esc y clic fuera la cierran).
   El reset de Tailwind le quita al <dialog> el margin:auto que lo centra: por eso lleva m-auto. */
export default function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className="m-auto max-h-[calc(100dvh-32px)] w-[min(540px,calc(100%-32px))] overflow-y-auto rounded-[18px] bg-crema p-0 shadow-modal backdrop:bg-[rgba(53,21,27,0.55)]"
      onClose={onCerrar}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close() }}
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
