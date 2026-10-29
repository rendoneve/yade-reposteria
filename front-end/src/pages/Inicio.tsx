import { useState } from 'react'
import DetalleProducto from '../components/DetalleProducto'
import Encabezado from '../components/Encabezado'
import { EsqueletoPostres, MensajeError, Vacio } from '../components/Estado'
import Pie from '../components/Pie'
import TarjetaPostre from '../components/TarjetaPostre'
import { api, type Producto } from '../lib/api'
import { degradadoHero, hero, heroLinea, heroLineaChica, heroTitulo, pagina } from '../lib/estilos'
import { useNegocio } from '../lib/negocio'
import { useDatos } from '../lib/useDatos'

const cargarDestacados = () => api<Producto[]>('/productos/destacados', { params: { limit: 4 } })

/* PAGINA PRINCIPAL (Figma 1:2) */
export default function Inicio() {
  const { heroPropio, heroImagen, heroLineas } = useNegocio()
  // "Especiales del mes": los más vendidos o, si no hay, los más recientes (lo resuelve el backend)
  const { datos, error, cargando, recargar } = useDatos('productos:destacados', cargarDestacados)
  const [viendo, setViendo] = useState<Producto | null>(null)

  return (
    <div className={pagina}>
      <section className={`${hero} ${degradadoHero} z-1 h-[620px] max-[760px]:overflow-hidden`}>
        {heroPropio ? (
          <>
            {/* Foto que subió el negocio: a todo lo ancho, con degradado para que se lea el texto */}
            <img
              src={heroPropio}
              className="absolute inset-0 z-0 h-full w-full object-cover"
              alt=""
              fetchPriority="high"
            />
            <div className="pointer-events-none absolute inset-0 z-10 bg-[linear-gradient(to_bottom_right,#2C1217_0%,transparent_75%)]" />
          </>
        ) : (
          // Ilustración del diseño, a la derecha del texto
          <img
            className="pointer-events-none absolute top-[92px] left-[calc(50%+32px)] h-auto w-[560px] max-w-none max-[1280px]:right-8 max-[1280px]:left-auto max-[1280px]:top-[120px] max-[1280px]:w-[460px] max-[1000px]:top-[170px] max-[1000px]:w-[380px] max-[760px]:static max-[760px]:mx-auto max-[760px]:mt-5 max-[760px]:w-full max-[760px]:max-w-[360px]"
            src={heroImagen}
            width={802}
            height={840}
            alt=""
            fetchPriority="high"
          />
        )}

        {/* Encabezado y texto por encima de la imagen y el degradado */}
        <div className="relative z-20">
          <Encabezado />
          <h1 className={`${heroTitulo} top-[180px] h-[230px]`}>
            {/* El primer renglón va un poco más chico, como en el diseño */}
            {heroLineas.map((l, i) => (
              <span key={i} className={i === 0 && heroLineas.length > 1 ? heroLineaChica : heroLinea}>
                {l}
              </span>
            ))}
          </h1>
        </div>
      </section>

      <main className="flex-1 px-6 pt-11 pb-[100px]">
        <h2 className="mb-10 text-center font-ui text-[52px] leading-[1.2] font-bold text-dorado max-[760px]:text-4xl">Especiales del mes</h2>
        {error && <MensajeError texto={error} reintentar={recargar} />}
        {datos && datos.length === 0 && <Vacio texto="Pronto tendremos postres especiales." />}
        <div className="flex flex-wrap justify-center gap-12 max-[1280px]:gap-8">
          {cargando && <EsqueletoPostres />}
          {datos?.map((p) => <TarjetaPostre key={p.id} producto={p} onVer={setViendo} />)}
        </div>
      </main>
      <Pie />
      {viendo && <DetalleProducto producto={viendo} onCerrar={() => setViendo(null)} />}
    </div>
  )
}
