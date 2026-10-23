import AdminLayout from '../../components/AdminLayout'

/* Paquetes, Reseñas y Configuración aparecen en el menú del diseño pero aún no tienen pantalla. */
export default function Proximamente({ titulo }: { titulo: string }) {
  return (
    <AdminLayout titulo={titulo}>
      <section className="tarjeta-admin tarjeta-admin--vacia">
        <p>Esta sección todavía no está diseñada en Figma.</p>
      </section>
    </AdminLayout>
  )
}
