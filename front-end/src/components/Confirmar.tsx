import { useState, type ReactNode } from 'react'
import { accionesAdmin, botonPeligro, botonPildora, errorPublico } from '../lib/estilos'
import Modal from './Modal'

/* Pregunta antes de una acción que no se puede deshacer (eliminar, cancelar…). */
export default function Confirmar({
  titulo,
  children,
  textoAccion,
  textoCancelar = 'No, regresar',
  onConfirmar,
  onCerrar,
}: {
  titulo: string
  children: ReactNode
  textoAccion: string
  textoCancelar?: string
  onConfirmar: () => Promise<unknown>
  onCerrar: () => void
}) {
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const confirmar = async () => {
    setEnviando(true)
    setError(null)
    try {
      await onConfirmar()
    } catch (e) {
      setError((e as Error).message)
      setEnviando(false)
    }
  }

  return (
    <Modal titulo={titulo} onCerrar={onCerrar}>
      <div className="font-texto text-base leading-normal">{children}</div>
      {error && <p className={`${errorPublico} mt-3`} role="alert">{error}</p>}
      <div className={`${accionesAdmin} mt-5`}>
        <button type="button" className={`${botonPildora} bg-transparent text-tinto-texto! enabled:hover:bg-tinto/10`} onClick={onCerrar}>
          {textoCancelar}
        </button>
        <button type="button" className={`${botonPeligro} mr-0!`} onClick={confirmar} disabled={enviando}>
          {enviando ? 'Un momento…' : textoAccion}
        </button>
      </div>
    </Modal>
  )
}
