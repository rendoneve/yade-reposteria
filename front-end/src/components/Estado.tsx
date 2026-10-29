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

/* Tarjetas "fantasma" del mismo tamaño que TarjetaPostre: la página no brinca cuando llegan los datos. */
export function EsqueletoPostres({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <>
      {Array.from({ length: cantidad }, (_, i) => (
        <div key={i} className="flex h-[362px] w-[260px] animate-pulse flex-col overflow-hidden rounded-[10px] border border-tinto-oscuro/20 bg-crema" aria-hidden="true">
          <div className="h-60 bg-chip" />
          <div className="mx-3.5 mt-3 h-4 w-3/4 rounded bg-chip" />
          <div className="mx-3.5 mt-2 h-3 w-full rounded bg-chip/70" />
          <div className="mx-3.5 mt-2 h-4 w-1/3 rounded bg-chip" />
        </div>
      ))}
      <span className="sr-only" role="status">Cargando postres…</span>
    </>
  )
}
