/* Mensajes de carga / error / vacío reutilizables */
export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return <p className="estado-msg" role="status">{texto}</p>
}

export function MensajeError({ texto, reintentar }: { texto: string; reintentar?: () => void }) {
  return (
    <div className="estado-msg estado-msg--error" role="alert">
      <p>{texto}</p>
      {reintentar && <button type="button" onClick={reintentar}>Reintentar</button>}
    </div>
  )
}

export function Vacio({ texto }: { texto: string }) {
  return <p className="estado-msg">{texto}</p>
}
