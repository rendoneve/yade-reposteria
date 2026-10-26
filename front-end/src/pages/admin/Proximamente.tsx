import AdminLayout from '../../components/AdminLayout'
import { tarjetaAdmin } from '../../lib/estilos'

/* Paquetes, Reseñas y Configuración aparecen en el menú del diseño pero aún no tienen pantalla. */
export default function Proximamente({ titulo }: { titulo: string }) {
  return (
    <AdminLayout titulo={titulo}>
      <section className={`${tarjetaAdmin} grid place-content-center px-7 font-texto text-lg leading-[1.4] text-texto-secundario`}>
        <p>Esta sección todavía no está diseñada en Figma.</p>
      </section>
    </AdminLayout>
  )
}
