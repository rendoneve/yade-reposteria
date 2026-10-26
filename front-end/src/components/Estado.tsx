/* Mensajes de carga / error / vacío reutilizables */
const mensaje = 'py-5 font-texto text-base leading-[1.4]'

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p className={`${mensaje} text-texto-secundario`} role="status">{texto}</p>
}

export function MensajeError({ texto, reintentar }: { texto: string; reintentar?: () => void }) {
  return (
    <div className={`${mensaje} flex items-center gap-3.5 text-error`} role="alert">
      <p>{texto}</p>
      {reintentar && (
        <button type="button" className="rounded-lg border border-error px-3 py-1 hover:bg-error/10" onClick={reintentar}>
          Reintentar
        </button>
      )}
    </div>
  )
}

export function Vacio({ texto }: { texto: string }) {
  return <p className={`${mensaje} text-texto-secundario`}>{texto}</p>
}
