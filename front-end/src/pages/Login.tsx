import { useState, type FormEvent } from 'react'
import { useSesion } from '../lib/auth'
import { botonOscuro, campoAdmin, controlAdmin, errorAdmin, fondoLogin } from '../lib/estilos'
import { useNegocio } from '../lib/negocio'
import { Link } from '../lib/router'

const controlLogin = `${controlAdmin} px-3 py-2.5 text-base`

/* Inicio de sesión del panel (no está en Figma; usa la paleta del panel). */
export default function Login() {
  const { entrar, salir } = useSesion()
  const { logo, nombre } = useNegocio()
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setEnviando(true)
    setError(null)
    try {
      const u = await entrar(String(f.get('usuario')), String(f.get('password')))
      // Las cuentas de clientes no entran al panel
      if (u.rol !== 'admin') {
        salir()
        setError('Esta cuenta no tiene acceso al panel de administración.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className={fondoLogin}>
      <form className="flex w-[min(400px,100%)] flex-col gap-[15px] rounded-[18px] bg-crema p-8 shadow-[0_20px_60px_rgba(0,0,0,0.35)]" onSubmit={enviar}>
        <img src={logo} width={218} height={106} alt={nombre} className="w-[110px] self-center brightness-25 sepia -hue-rotate-30 saturate-300" />
        <h1 className="text-center font-titulo text-[30px] leading-[1.1] font-bold text-tinto-texto">Panel de administración</h1>
        <label className={campoAdmin}>
          Usuario o correo
          <input className={controlLogin} name="usuario" required autoComplete="username" autoFocus />
        </label>
        <label className={campoAdmin}>
          Contraseña
          <input className={controlLogin} name="password" type="password" required autoComplete="current-password" />
        </label>
        {error && <p className={errorAdmin} role="alert">{error}</p>}
        <button className={botonOscuro} type="submit" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
        <Link to="/" className="text-center font-ui text-[13px] leading-none font-semibold text-dorado">← Volver al sitio</Link>
      </form>
    </div>
  )
}
