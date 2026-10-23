import { useEffect, useRef, type ReactNode } from 'react'

/* Ventana modal con <dialog> nativo (Esc y clic fuera la cierran). */
export default function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])
  return (
    <dialog
      ref={ref}
      className="modal"
      onClose={onCerrar}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close() }}
    >
      <div className="modal__caja">
        <div className="modal__cabecera">
          <h2>{titulo}</h2>
          <button type="button" className="modal__cerrar" aria-label="Cerrar" onClick={() => ref.current?.close()}>×</button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
