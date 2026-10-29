import AdminLayout from '../../components/AdminLayout'
import { tarjetaAdmin } from '../../lib/estilos'

/* Paquetes aparece en el menú del diseño pero aún no tiene pantalla. */
export default function Proximamente({ titulo }: { titulo: string }) {
  return (
    <AdminLayout titulo={titulo}>
      <section className={`${tarjetaAdmin} grid place-content-center px-7 font-texto text-lg leading-[1.4] text-texto-secundario`}>
        <p>Esta sección estará disponible pronto.</p>
      </section>
    </AdminLayout>
  )
}
