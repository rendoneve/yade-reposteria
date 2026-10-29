import { useState, type FormEvent } from 'react'
import CuentaLayout from '../../components/CuentaLayout'
import { useSesion } from '../../lib/sesion'
import { botonOscuro, campoPublico, controlPublico, enlaceDorado, errorPublico, tarjetaCuenta } from '../../lib/estilos'
import Link from '../../components/Link'
import { navegar, rutaSiguiente, useRuta } from '../../lib/router'

/* Crear cuenta de cliente. Al terminar deja la sesión iniciada. */
export default function Registro() {
  const { query } = useRuta()
  const { registrar } = useSesion()
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const siguiente = rutaSiguiente(query)

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const password = String(f.get('password'))
    if (password !== String(f.get('confirmar'))) {
      setError('Las contraseñas no coinciden')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      await registrar({
        nombre_completo: String(f.get('nombre')).trim(),
        username: String(f.get('username')).trim(),
        correo: String(f.get('correo')).trim(),
        telefono: String(f.get('telefono')).trim() || null,
        password,
      })
      navegar(siguiente ?? '/cuenta', true)
    } catch (err) {
      setError((err as Error).message)
      setEnviando(false)
    }
  }

  const entrar = `/entrar${siguiente ? `?siguiente=${encodeURIComponent(siguiente)}` : ''}`

  return (
    <CuentaLayout titulo="Crear cuenta">
      <form className={tarjetaCuenta} onSubmit={enviar}>
        <label className={campoPublico}>
          Nombre completo
          <input className={controlPublico} name="nombre" required maxLength={150} autoComplete="name" autoFocus />
        </label>
        <label className={campoPublico}>
          Nombre de usuario
          <input
            className={controlPublico} name="username" required minLength={3} maxLength={50}
            pattern="[A-Za-z0-9_.\-]+" title="Letras, números, punto, guion o guion bajo" autoComplete="username"
          />
        </label>
        <label className={campoPublico}>
          Correo
          <input className={controlPublico} name="correo" type="email" required autoComplete="email" />
        </label>
        <label className={campoPublico}>
          Teléfono (opcional)
          <input className={controlPublico} name="telefono" type="tel" pattern="[0-9+()\s\-]{7,20}" autoComplete="tel" />
        </label>
        <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
          <label className={campoPublico}>
            Contraseña
            <input className={controlPublico} name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
          </label>
          <label className={campoPublico}>
            Confirmar contraseña
            <input className={controlPublico} name="confirmar" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
          </label>
        </div>
        {error && <p className={errorPublico} role="alert">{error}</p>}
        <button className={botonOscuro} type="submit" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <p className="text-center font-texto text-[15px]">
          ¿Ya tienes cuenta? <Link to={entrar} className={`${enlaceDorado} text-[15px]`}>Inicia sesión</Link>
        </p>
      </form>
    </CuentaLayout>
  )
}
