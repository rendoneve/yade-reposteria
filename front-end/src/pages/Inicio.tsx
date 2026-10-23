import heroInicio from '../assets/img/hero-inicio.png'
import Encabezado from '../components/Encabezado'
import { Cargando, MensajeError, Vacio } from '../components/Estado'
import Pie from '../components/Pie'
import TarjetaPostre from '../components/TarjetaPostre'
import { api, type Producto } from '../lib/api'
import { useDatos } from '../lib/useDatos'

/* PAGINA PRINCIPAL (Figma 1:2) */
export default function Inicio() {
  // "Especiales del mes": los más vendidos; si no hay, los más recientes.
  const { datos, error, cargando, recargar } = useDatos(async () => {
    const top = await api<Producto[]>('/productos', { params: { etiqueta: 'mas vendidos', limit: 4 } })
    return top.length ? top : api<Producto[]>('/productos', { params: { limit: 4 } })
  })

  return (
    <div className="pagina">
      <section className="hero hero--inicio">
        <Encabezado />
        <h1 className="hero__titulo">
          <span className="hero__linea hero__linea--chica">El postre perfecto</span>
          <span className="hero__linea">siempre es una</span>
          <span className="hero__linea">BUENA IDEA</span>
        </h1>
        <img className="hero__imagen hero__imagen--inicio" src={heroInicio} width={802} height={840} alt="" />
      </section>

      <main className="especiales">
        <h2 className="especiales__titulo">Especiales del mes</h2>
        {cargando && <Cargando />}
        {error && <MensajeError texto={error} reintentar={recargar} />}
        {datos && datos.length === 0 && <Vacio texto="Pronto tendremos postres especiales." />}
        {datos && datos.length > 0 && (
          <div className="especiales__grid">
            {datos.map((p) => <TarjetaPostre key={p.id} producto={p} />)}
          </div>
        )}
      </main>
      <Pie />
    </div>
  )
}
