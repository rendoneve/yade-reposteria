import { useState } from 'react'
import BarraConfianza from '../components/BarraConfianza'
import ComoFunciona from '../components/ComoFunciona'
import DetalleProducto from '../components/DetalleProducto'
import TextoRico from '../components/TextoRico'
import Encabezado from '../components/Encabezado'
import { EsqueletoPostres, MensajeError, Vacio } from '../components/Estado'
import LlamadoFinal from '../components/LlamadoFinal'
import Link from '../components/Link'
import Pie from '../components/Pie'
import SeccionCategorias from '../components/SeccionCategorias'
import SeccionResenas from '../components/SeccionResenas'
import TarjetaPostre from '../components/TarjetaPostre'
import { api, type Producto } from '../lib/api'
import { degradadoHero, hero, heroLinea, heroLineaChica, heroTitulo, pagina } from '../lib/estilos'
import { useNegocio } from '../lib/negocio'
import { useDatos } from '../lib/useDatos'

const cargarDestacados = () => api<Producto[]>('/productos/destacados', { params: { limit: 4 } })

/* PAGINA PRINCIPAL (Figma 1:2) */
export default function Inicio() {
  const { heroPropio, heroImagen, heroLineas, cargando: cargandoNegocio } = useNegocio()
  // "Especiales del mes": los más vendidos o, si no hay, los más recientes (lo resuelve el backend)
  const { datos, error, cargando, recargar } = useDatos('productos:destacados', cargarDestacados)
  const [viendo, setViendo] = useState<Producto | null>(null)

  return (
    <div className={pagina}>
      {/* ÁREA 1 · HERO: portada con título del negocio (editable en Configuración), imagen y los dos botones principales. */}
      <section className={`${hero} ${degradadoHero} z-1 h-[620px] max-[760px]:overflow-hidden`}>
        {/* Primera visita: mientras llega /negocio no se muestra la imagen ni el texto del diseño,
            para que no cambien a los pocos segundos por los del negocio */}
        {cargandoNegocio ? null : heroPropio ? (
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
          <h1 className={`${heroTitulo} top-[180px] h-[230px]`} aria-busy={cargandoNegocio}>
            {/* El primer renglón va un poco más chico, como en el diseño */}
            {!cargandoNegocio && heroLineas.map((l, i) => (
              <span key={i} className={i === 0 && heroLineas.length > 1 ? heroLineaChica : heroLinea}>
                <TextoRico texto={l} />
              </span>
            ))}
          </h1>
          {/* Llamados a la acción: lo primero que puede hacer quien llega */}
          <div className="absolute top-[440px] left-margen flex flex-wrap gap-3.5 max-[760px]:static max-[760px]:mt-7">
            <Link
              to="/agendar"
              className="h-[48px] rounded-3xl bg-beige px-8 font-texto text-[18px] leading-[48px] text-tinto-oscuro shadow-[0_6px_18px_rgba(0,0,0,0.25)] transition hover:-translate-y-0.5 hover:bg-white"
            >
              Agendar cita
            </Link>
            <Link
              to="/catalogo"
              className="h-[48px] rounded-3xl border border-beige px-8 font-texto text-[18px] leading-[46px] text-beige transition-colors hover:bg-beige/15"
            >
              Ver el menú
            </Link>
          </div>
        </div>
      </section>

      {/* ÁREA 2 · BARRA DE CONFIANZA: calificación promedio, número de postres, si está abierto ahora y cita en línea. */}
      <BarraConfianza />

      {/* CONTENIDO: se apila de arriba abajo; cada bloque es un componente independiente. */}
      <main className="flex-1 px-margen pt-[72px] pb-[100px] max-[760px]:px-4 max-[760px]:pt-12 max-[760px]:pb-20">
        {/* ÁREA 3 · ESPECIALES DEL MES: 4 postres destacados (más vendidos o recientes). Al tocar uno se abre su detalle. */}
        <section aria-labelledby="titulo-especiales">
          <h2 id="titulo-especiales" className="aparecer mb-10 text-center font-ui text-[52px] leading-[1.2] font-bold text-dorado max-[760px]:text-4xl">Especiales del mes</h2>
          {error && <MensajeError texto={error} reintentar={recargar} />}
          {datos && datos.length === 0 && <Vacio texto="Pronto tendremos postres especiales." />}
          <div className="flex flex-wrap justify-center gap-12 max-[1280px]:gap-8">
            {cargando && <EsqueletoPostres />}
            {datos?.map((p) => <TarjetaPostre key={p.id} producto={p} onVer={setViendo} />)}
          </div>
          <p className="mt-10 text-center">
            <Link to="/catalogo" className="font-ui text-lg font-semibold text-dorado-texto hover:underline">Ver todo el menú →</Link>
          </p>
        </section>

        {/* ÁREA 4 · CATEGORÍAS: mosaico con enlace directo al menú filtrado por categoría. */}
        <SeccionCategorias />
        {/* ÁREA 5 · "ASÍ DE FÁCIL": pasos para pedir (elegir, agendar, recoger). */}
        <ComoFunciona />
        {/* ÁREA 6 · RESEÑAS: carrusel de opiniones aprobadas por el admin y calificación general. */}
        <SeccionResenas />
        {/* ÁREA 7 · LLAMADO FINAL: último empujón para agendar cita. */}
        <LlamadoFinal />
      </main>
      {/* ÁREA 8 · PIE: contacto, horarios y enlaces (compartido por todas las páginas públicas). */}
      <Pie />
      {/* VENTANA DE DETALLE: aparece al elegir un postre de "Especiales". */}
      {viendo && <DetalleProducto producto={viendo} onCerrar={() => setViendo(null)} />}
    </div>
  )
}
