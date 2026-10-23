import { useState, type FormEvent } from 'react'
import logo from '../assets/img/logo-yade-footer.png'
import { useSesion } from '../lib/auth'
import { Link } from '../lib/router'

/* Inicio de sesión del panel (no está en Figma; usa la paleta del panel). */
export default function Login() {
  const { entrar } = useSesion()
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setEnviando(true)
    setError(null)
    try {
      await entrar(String(f.get('usuario')), String(f.get('password')))
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <form className="login__tarjeta" onSubmit={enviar}>
        <img src={logo} width={218} height={106} alt="Yade" className="login__logo" />
        <h1 className="login__titulo">Panel de administración</h1>
        <label>
          Usuario o correo
          <input name="usuario" required autoComplete="username" autoFocus />
        </label>
        <label>
          Contraseña
          <input name="password" type="password" required autoComplete="current-password" />
        </label>
        {error && <p className="login__error" role="alert">{error}</p>}
        <button className="boton-oscuro" type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <Link to="/" className="login__volver">← Volver al sitio</Link>
      </form>
    </div>
  )
}
