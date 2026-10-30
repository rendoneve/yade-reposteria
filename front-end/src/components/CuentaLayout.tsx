import type { ReactNode } from 'react'
import { useSesion } from '../lib/sesion'
import { degradadoHero, hero, heroLinea, heroTitulo, pagina } from '../lib/estilos'
import Link from './Link'
import { navegar, useRuta } from '../lib/router'
import Encabezado from './Encabezado'
import Pie from './Pie'

const MENU = [
  { to: '/cuenta', texto: 'Mi perfil' },
  { to: '/cuenta/citas', texto: 'Mis citas' },
  { to: '/cuenta/resenas', texto: 'Mis reseñas' },
]

const pestana =
  'flex h-[38px] items-center rounded-[19px] border border-rosa-vino px-[18px] font-ui text-[15px] leading-none font-semibold text-tinto-texto transition-colors hover:bg-tinto/10 aria-[current=page]:border-tinto aria-[current=page]:bg-tinto aria-[current=page]:text-white'

/* Estructura de las páginas de cuenta del cliente (no están en Figma; usan los estilos del sitio).
   Con `menu` muestra las pestañas del panel del cliente. */
export default function CuentaLayout({ titulo, menu = false, children }: { titulo: string; menu?: boolean; children: ReactNode }) {
  const { path } = useRuta()
  const { usuario, salir } = useSesion()

  const cerrarSesion = () => {
    salir()
    navegar('/')
  }

  return (
    <div className={pagina}>
      {/* HERO: título de la pantalla de cuenta. */}
      <section className={`${hero} ${degradadoHero} h-[280px]`}>
        <Encabezado />
        <h1 className={`${heroTitulo} top-[110px] h-[110px]`}>
          <span className={heroLinea}>{titulo}</span>
        </h1>
      </section>
      {/* CONTENIDO centrado (máx. 860 px). */}
      <main className="flex-1 px-margen pt-[50px] pb-[100px] max-[760px]:px-4 max-[760px]:pt-8 max-[760px]:pb-20">
        <div className="mx-auto max-w-[860px]">
          {/* PESTAÑAS de la cuenta (Mi perfil / Mis citas / Mis reseñas) y botón "Cerrar sesión". Solo con prop menu (las pantallas de entrar/registro no lo llevan). */}
          {menu && (
            <div className="mb-7 flex flex-wrap items-center gap-2.5">
              <nav className="flex flex-wrap gap-2.5" aria-label="Mi cuenta">
                {MENU.map((m) => (
                  <Link key={m.to} to={m.to} className={pestana} aria-current={path === m.to ? 'page' : undefined}>
                    {m.texto}
                  </Link>
                ))}
              </nav>
              <span className="ml-auto font-texto text-[15px] text-texto-secundario max-[560px]:w-full">
                {usuario?.nombre_completo} ·{' '}
                <button type="button" className="font-ui font-semibold text-dorado hover:underline" onClick={cerrarSesion}>
                  Cerrar sesión
                </button>
              </span>
            </div>
          )}
          {/* Contenido propio de cada pantalla de cuenta. */}
          {children}
        </div>
      </main>
      {/* PIE compartido. */}
      <Pie />
    </div>
  )
}
