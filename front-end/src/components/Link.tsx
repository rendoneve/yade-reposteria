import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { navegar } from '../lib/router'

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }

/* Enlace interno: cambia de pantalla sin recargar (Ctrl/⌘ + clic sigue abriendo otra pestaña). */
export default function Link({ to, onClick, ...resto }: LinkProps) {
  const alClic = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e)
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    navegar(to)
  }
  return <a href={to} onClick={alClic} {...resto} />
}
