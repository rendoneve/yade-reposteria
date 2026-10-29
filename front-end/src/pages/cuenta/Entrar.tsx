import { useState, type FormEvent } from 'react'
import CuentaLayout from '../../components/CuentaLayout'
import { useSesion } from '../../lib/sesion'
import { botonOscuro, campoPublico, controlPublico, enlaceDorado, errorPublico, tarjetaCuenta } from '../../lib/estilos'
import Link from '../../components/Link'
import { navegar, rutaSiguiente, useRuta } from '../../lib/router'

/* Inicio de sesión de clientes. En /cuenta/* se muestra en lugar de la página mientras no hay sesión. */
export default function Entrar() {
  const { path, query } = useRuta()
  const { entrar } = useSesion()
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const siguiente = rutaSiguiente(query)

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setEnviando(true)
    setError(null)
    try {
      const u = await entrar(String(f.get('usuario')).trim(), String(f.get('password')))
      // En /cuenta/* la página pedida aparece sola al haber sesión
      if (path === '/entrar') navegar(siguiente ?? (u.rol === 'admin' ? '/admin' : '/cuenta'), true)
    } catch (err) {
      setError((err as Error).message)
      setEnviando(false)
    }
  }

  const registro = `/registro${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}`

  return (
    <CuentaLayout titulo="Iniciar sesión">
      <form className={tarjetaCuenta} onSubmit={enviar}>
        <p className="font-texto text-base leading-normal text-texto-secundario">
          Entra para ver tus citas, cancelarlas y dejar tu reseña.
        </p>
        <label className={campoPublico}>
          Usuario o correo
          <input className={controlPublico} name="usuario" required autoComplete="username" autoFocus />
        </label>
        <label className={campoPublico}>
          Contraseña
          <input className={controlPublico} name="password" type="password" required autoComplete="current-password" />
        </label>
        {error && <p className={errorPublico} role="alert">{error}</p>}
        <button className={botonOscuro} type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <p className="text-center font-texto text-[15px]">
          ¿No tienes cuenta? <Link to={registro} className={`${enlaceDorado} text-[15px]`}>Crea una</Link>
        </p>
      </form>
    </CuentaLayout>
  )
}
