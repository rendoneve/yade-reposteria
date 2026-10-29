/* Cargadores compartidos de la caché (lib/cache.ts).

   Una clave = un cargador: si dos pantallas piden "categorias", las dos reciben exactamente lo mismo
   (antes Agendar no las ordenaba y, según por dónde se entrara, el Catálogo las mostraba en otro orden). */
import { api, type Categoria, type Cita, type Etiqueta, type Producto, type ProductoOpcion, type Resena } from './api'

const porId = <T extends { id: number }>(lista: T[]) => [...lista].sort((a, b) => a.id - b.id)

// Categorías y etiquetas en el orden en que se crearon (así las acomoda el administrador)
export const CATEGORIAS = 'categorias'
export const cargarCategorias = () => api<Categoria[]>('/categorias').then(porId)

export const ETIQUETAS = 'etiquetas'
export const cargarEtiquetas = () => api<Etiqueta[]>('/etiquetas').then(porId)

export const claveProductos = (categoriaId: number) => `productos:categoria:${categoriaId}`
export const cargarProductos = (categoriaId: number) => () =>
  api<Producto[]>('/productos', { params: { categoria_id: categoriaId, limit: 500 } })

export const OPCIONES_PRODUCTOS = 'productos:opciones'
export const cargarOpcionesProductos = () => api<ProductoOpcion[]>('/productos/opciones')

// Cuenta del cliente: se borran al cambiar de sesión
export const MIS_CITAS = 'citas:mias'
export const cargarMisCitas = () => api<Cita[]>('/citas/mias')

export const MIS_RESENAS = 'resenas:mias'
export const cargarMisResenas = () => api<Resena[]>('/resenas/mias')
