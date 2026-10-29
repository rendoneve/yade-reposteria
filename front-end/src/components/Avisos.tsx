import { X } from 'lucide-react'
import { useSyncExternalStore } from 'react'
import { leerAvisos, quitarAviso, suscribirAvisos } from '../lib/avisos'

/* Se monta una vez en App: muestra los avisos de lib/avisos.ts */
export default function Avisos() {
  const avisos = useSyncExternalStore(suscribirAvisos, leerAvisos)
  return (
    <div className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-[min(360px,calc(100%-32px))] flex-col gap-2" aria-live="polite">
      {avisos.map((a) => (
        <div
          key={a.id}
          role={a.tipo === 'error' ? 'alert' : 'status'}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 font-ui text-sm leading-[1.4] font-semibold text-white shadow-modal ${a.tipo === 'error' ? 'bg-error' : 'bg-exito'}`}
        >
          <p className="flex-1">{a.texto}</p>
          <button type="button" className="rounded-full p-0.5 hover:bg-white/20" aria-label="Cerrar aviso" onClick={() => quitarAviso(a.id)}>
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
