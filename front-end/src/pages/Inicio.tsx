import Encabezado from '../components/Encabezado'
import { Cargando, MensajeError, Vacio } from '../components/Estado'
import Pie from '../components/Pie'
import TarjetaPostre from '../components/TarjetaPostre'
import { api, type Producto } from '../lib/api'
import { degradadoHero, hero, heroLinea, heroLineaChica, heroTitulo, pagina } from '../lib/estilos'
import { useNegocio } from '../lib/negocio'
import { useDatos } from '../lib/useDatos'

/* PAGINA PRINCIPAL (Figma 1:2) */
export default function Inicio() {
  const { heroImagen, heroLineas } = useNegocio()
  // "Especiales del mes": los más vendidos; si no hay, los más recientes.
  const { datos, error, cargando, recargar } = useDatos(async () => {
    const top = await api<Producto[]>('/productos', { params: { etiqueta: 'mas vendidos', limit: 4 } })
    return top.length ? top : api<Producto[]>('/productos', { params: { limit: 4 } })
  })

  return (
    <div className={pagina}>
      <section className={`${hero} ${degradadoHero} z-1 h-[620px] max-[760px]:overflow-hidden`}>
        <Encabezado />
        <h1 className={`${heroTitulo} top-[180px] h-[230px]`}>
          {/* El primer renglón va un poco más chico, como en el diseño */}
          {heroLineas.map((l, i) => <span key={i} className={i === 0 && heroLineas.length > 1 ? heroLineaChica : heroLinea}>{l}</span>)}
        </h1>
        <img className="pointer-events-none absolute top-[92px] left-[calc(50%+32px)] h-auto w-[560px] max-w-none max-[1280px]:right-8 max-[1280px]:left-auto max-[1280px]:top-[120px] max-[1280px]:w-[460px] max-[1000px]:top-[170px] max-[1000px]:w-[380px] max-[760px]:static max-[760px]:mx-auto max-[760px]:mt-5 max-[760px]:w-full max-[760px]:max-w-[360px]" src={heroImagen} width={802} height={840} alt="" />
      </section>

      <main className="flex-1 px-6 pt-11 pb-[100px]">
        <h2 className="mb-10 text-center font-ui text-[52px] leading-[1.2] font-bold text-dorado max-[760px]:text-4xl">Especiales del mes</h2>
        {cargando && <Cargando />}
        {error && <MensajeError texto={error} reintentar={recargar} />}
        {datos && datos.length === 0 && <Vacio texto="Pronto tendremos postres especiales." />}
        {datos && datos.length > 0 && (
          <div className="grid grid-cols-[repeat(4,260px)] justify-center gap-12 max-[1280px]:grid-cols-[repeat(auto-fill,260px)] max-[1280px]:gap-8">
            {datos.map((p) => <TarjetaPostre key={p.id} producto={p} />)}
          </div>
        )}
      </main>
      <Pie />
    </div>
  )
}
