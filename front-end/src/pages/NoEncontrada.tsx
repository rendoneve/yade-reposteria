import Encabezado from '../components/Encabezado'
import Link from '../components/Link'
import Pie from '../components/Pie'
import { botonOscuro, degradadoHero, enlaceDorado, hero, heroLinea, heroLineaChica, heroTitulo, pagina, tarjetaCrema } from '../lib/estilos'

/* Página para una dirección que no existe (antes se mostraba Inicio sin avisar). */
export default function NoEncontrada() {
  return (
    <div className={pagina}>
      <section className={`${hero} ${degradadoHero} h-[340px]`}>
        <Encabezado />
        <h1 className={`${heroTitulo} top-[120px] h-[160px]`}>
          <span className={heroLineaChica}>Error 404</span>
          <span className={heroLinea}>Página no encontrada</span>
        </h1>
      </section>
      <main className="flex flex-1 items-start justify-center px-margen pt-[60px] pb-[100px] max-[760px]:px-4 max-[760px]:pt-10 max-[760px]:pb-20">
        <div className={`${tarjetaCrema} aparecer flex max-w-[560px] flex-col items-center gap-5 px-10 py-10 text-center max-[560px]:px-6`}>
          <p className="font-titulo text-[96px] leading-none font-bold text-dorado max-[560px]:text-7xl" aria-hidden="true">404</p>
          <p className="font-texto text-lg leading-normal">
            Esta página no existe o cambió de lugar. Pero los postres siguen aquí.
          </p>
          <div className="flex w-full flex-wrap justify-center gap-3">
            <Link to="/catalogo" className={`${botonOscuro} flex min-w-[180px] items-center justify-center px-6`}>Ver el menú</Link>
            <Link
              to="/agendar"
              className="flex h-[42px] min-w-[180px] items-center justify-center rounded-2xl border border-tinto-oscuro px-6 font-texto text-[17px] text-tinto-oscuro transition-colors hover:bg-tinto-oscuro/10"
            >
              Agendar cita
            </Link>
          </div>
          <Link to="/" className={`${enlaceDorado} text-[15px]`}>← Volver al inicio</Link>
        </div>
      </main>
      <Pie />
    </div>
  )
}
