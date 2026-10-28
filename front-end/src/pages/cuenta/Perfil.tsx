import { useEffect, useState, type FormEvent } from 'react'
import CuentaLayout from '../../components/CuentaLayout'
import { api, type Usuario } from '../../lib/api'
import { useSesion } from '../../lib/auth'
import { botonOscuro, campoPublico, controlPublico, errorPublico, tarjetaCrema } from '../../lib/estilos'

const tarjeta = `${tarjetaCrema} mb-6 flex flex-col gap-4 px-[34px] py-7 max-[560px]:px-5`
const titulo = 'font-titulo text-[30px] leading-[1.1] font-bold text-tinto-texto'
const exito = 'font-ui text-sm leading-[1.4] font-semibold text-exito'

/* Aviso de "guardado" que se quita solo a los pocos segundos. */
function useAvisoTemporal() {
  const [aviso, setAviso] = useState(false)
  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(false), 4000)
    return () => clearTimeout(t)
  }, [aviso])
  return [aviso, setAviso] as const
}

/* Panel del cliente: editar sus datos y su contraseña. */
export default function Perfil() {
  const { usuario } = useSesion()
  return (
    <CuentaLayout titulo="Mi cuenta" menu>
      {usuario && <FormDatos usuario={usuario} />}
      <FormPassword />
    </CuentaLayout>
  )
}

function FormDatos({ usuario }: { usuario: Usuario }) {
  const { actualizar } = useSesion()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useAvisoTemporal()

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setGuardando(true)
    setError(null)
    try {
      actualizar(await api<Usuario>('/auth/me', {
        method: 'PATCH',
        body: {
          nombre_completo: String(f.get('nombre')).trim(),
          correo: String(f.get('correo')).trim(),
          telefono: String(f.get('telefono')).trim() || null,
        },
      }))
      setGuardado(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className={tarjeta} onSubmit={enviar}>
      <h2 className={titulo}>Mis datos</h2>
      <label className={campoPublico}>
        Nombre de usuario
        <input className={`${controlPublico} bg-crema text-texto-secundario`} value={usuario.username} readOnly />
      </label>
      <label className={campoPublico}>
        Nombre completo
        <input className={controlPublico} name="nombre" required maxLength={150} autoComplete="name" defaultValue={usuario.nombre_completo} />
      </label>
      <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
        <label className={campoPublico}>
          Correo
          <input className={controlPublico} name="correo" type="email" required autoComplete="email" defaultValue={usuario.correo} />
        </label>
        <label className={campoPublico}>
          Teléfono
          <input className={controlPublico} name="telefono" type="tel" pattern="[0-9+()\s\-]{7,20}" autoComplete="tel" defaultValue={usuario.telefono ?? ''} />
        </label>
      </div>
      {error && <p className={errorPublico} role="alert">{error}</p>}
      {guardado && <p className={exito} role="status">Tus datos se guardaron.</p>}
      <button className={`${botonOscuro} self-end px-8`} type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}

function FormPassword() {
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useAvisoTemporal()

  const enviar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const f = new FormData(form)
    const nueva = String(f.get('nueva'))
    if (nueva !== String(f.get('confirmar'))) {
      setError('Las contraseñas nuevas no coinciden')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await api('/auth/me/password', { method: 'PUT', body: { actual: String(f.get('actual')), nueva } })
      form.reset()
      setGuardado(true)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form className={tarjeta} onSubmit={enviar}>
      <h2 className={titulo}>Contraseña</h2>
      <label className={campoPublico}>
        Contraseña actual
        <input className={controlPublico} name="actual" type="password" required autoComplete="current-password" />
      </label>
      <div className="grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
        <label className={campoPublico}>
          Nueva contraseña
          <input className={controlPublico} name="nueva" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
        </label>
        <label className={campoPublico}>
          Confirmar nueva contraseña
          <input className={controlPublico} name="confirmar" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
        </label>
      </div>
      {error && <p className={errorPublico} role="alert">{error}</p>}
      {guardado && <p className={exito} role="status">Tu contraseña se cambió.</p>}
      <button className={`${botonOscuro} self-end px-8`} type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
