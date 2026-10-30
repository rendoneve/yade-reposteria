import { Star } from 'lucide-react'

/* Calificación de 1 a 5 estrellas (solo lectura). */
export function Estrellas({ valor, tamano = 18, className = '' }: { valor: number; tamano?: number; className?: string }) {
  const llenas = Math.round(valor)
  return (
    <span className={`inline-flex gap-0.5 ${className}`} role="img" aria-label={`${valor} de 5 estrellas`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={tamano}
          aria-hidden="true"
          className={i < llenas ? 'text-dorado' : 'text-chip'}
          fill={i < llenas ? 'currentColor' : 'none'}
          strokeWidth={1.75}
        />
      ))}
    </span>
  )
}

/* Para que el cliente elija su calificación al reseñar. */
export function SelectorEstrellas({ valor, onCambio }: { valor: number; onCambio: (v: number) => void }) {
  const textos = ['Mala', 'Regular', 'Buena', 'Muy buena', 'Excelente']
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1" role="radiogroup" aria-label="Calificación">
        {Array.from({ length: 5 }, (_, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={valor === i + 1}
            aria-label={`${i + 1} de 5 — ${textos[i]}`}
            className="rounded p-0.5 transition-transform hover:scale-110"
            onClick={() => onCambio(i + 1)}
          >
            <Star
              size={30}
              aria-hidden="true"
              className={i < valor ? 'text-dorado' : 'text-rosa-vino'}
              fill={i < valor ? 'currentColor' : 'none'}
              strokeWidth={1.5}
            />
          </button>
        ))}
        {valor > 0 && <span className="ml-2 font-ui text-sm font-semibold text-dorado-texto">{textos[valor - 1]}</span>}
      </div>
    </div>
  )
}
