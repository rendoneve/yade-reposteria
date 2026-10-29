import { useState, type FormEvent } from "react";
import botonEditar from "../../assets/img/boton-editar.png";
import postreEjemplo from "../../assets/img/postre-ejemplo.webp";
import AdminLayout from "../../components/AdminLayout";
import Confirmar from "../../components/Confirmar";
import { Cargando, MensajeError, Vacio } from "../../components/Estado";
import Link from "../../components/Link";
import Modal from "../../components/Modal";
import SubirImagen from "../../components/SubirImagen";
import {
  api,
  ETIQUETA_DISPONIBILIDAD,
  resolverImagen,
  type CambioImagen,
  formatoPrecio,
  nombreEtiqueta,
  type Categoria,
  type Disponibilidad,
  type Etiqueta,
  type Producto,
} from "../../lib/api";
import {
  accionesAdmin,
  botonPeligro,
  botonPildora,
  campoAdmin,
  chipFiltro,
  controlAdmin,
  enlaceDorado,
  errorAdmin,
  filaAdmin,
  formAdmin,
  tarjetaCrema,
} from "../../lib/estilos";
import { avisar } from "../../lib/avisos";
import { precargar } from "../../lib/cache";
import { navegar, useRuta } from "../../lib/router";
import { useDatos } from "../../lib/useDatos";

const cargarCategorias = () =>
  api<Categoria[]>("/categorias").then((l) => [...l].sort((a, b) => a.id - b.id));
const cargarEtiquetas = () => api<Etiqueta[]>("/etiquetas");
const claveProductos = (id: number) => `productos:categoria:${id}`;
const cargarProductos = (id: number) => () =>
  api<Producto[]>("/productos", { params: { categoria_id: id, limit: 500 } });

const gridTarjetas =
  "mt-5 grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-x-4 gap-y-10";

/* ADMINISTRADOR productos (Figma 37:258): tarjetas de categorías. Al abrir una
   categoría se muestran sus productos con el mismo diseño de tarjeta. */
export default function Productos() {
  const { path } = useRuta();
  const id = Number(path.split("/")[3]) || null;
  return id ? <ProductosDeCategoria categoriaId={id} /> : <Categorias />;
}

/* ---------- Categorías ---------- */

function Categorias() {
  // En el orden en que se crearon (misma clave que el catálogo público: comparten caché)
  const categorias = useDatos("categorias", cargarCategorias);
  const [editando, setEditando] = useState<Categoria | "nueva" | null>(null);

  return (
    <AdminLayout
      titulo="Productos"
      acciones={
        <button
          type="button"
          className={`${botonPildora} min-w-[200px]`}
          onClick={() => setEditando("nueva")}
        >
          Añadir categoría
        </button>
      }
    >
      {categorias.cargando && <Cargando />}
      {categorias.error && (
        <MensajeError
          texto={categorias.error}
          reintentar={categorias.recargar}
        />
      )}
      {categorias.datos?.length === 0 && (
        <Vacio texto="Aún no hay categorías. Crea la primera con “Añadir categoría”." />
      )}
      <div className={gridTarjetas}>
        {categorias.datos?.map((c) => (
          <TarjetaAdmin
            key={c.id}
            imagen={c.imagen_url}
            titulo={c.nombre}
            subtitulo={`${c.cantidad_productos} ${c.cantidad_productos === 1 ? "elemento" : "elementos"}`}
            onAbrir={() => navegar(`/admin/productos/${c.id}`)}
            onPrecargar={() => precargar(claveProductos(c.id), cargarProductos(c.id))}
            onEditar={() => setEditando(c)}
          />
        ))}
      </div>
      {editando && (
        <FormCategoria
          categoria={editando === "nueva" ? null : editando}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            categorias.recargar();
          }}
        />
      )}
    </AdminLayout>
  );
}

function FormCategoria({
  categoria,
  onCerrar,
  onGuardado,
}: {
  categoria: Categoria | null;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [imagen, setImagen] = useState<CambioImagen>(undefined);
  const [confirmando, setConfirmando] = useState(false);

  const guardar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await ejecutar(categoria ? "Categoría guardada" : "Categoría creada", async () => {
      const body = {
        nombre: String(f.get("nombre")).trim(),
        imagen_url: await resolverImagen(imagen, categoria?.imagen_url ?? null),
      };
      return categoria
        ? api(`/categorias/${categoria.id}`, { method: "PATCH", body })
        : api("/categorias", { method: "POST", body });
    });
  };

  const eliminar = async () => {
    if (!categoria) return;
    await api(`/categorias/${categoria.id}`, { method: "DELETE" });
    avisar(`Categoría “${categoria.nombre}” eliminada`);
    onGuardado();
  };

  const ejecutar = async (mensaje: string, accion: () => Promise<unknown>) => {
    setEnviando(true);
    setError(null);
    try {
      await accion();
      avisar(mensaje);
      onGuardado();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Modal
      titulo={categoria ? "Editar categoría" : "Nueva categoría"}
      onCerrar={onCerrar}
    >
      <form className={formAdmin} onSubmit={guardar}>
        <label className={campoAdmin}>
          Nombre
          <input
            className={controlAdmin}
            name="nombre"
            required
            maxLength={100}
            defaultValue={categoria?.nombre}
          />
        </label>
        <div className={campoAdmin}>
          Imagen
          <SubirImagen
            imagenInicial={categoria?.imagen_url}
            onChange={setImagen}
            className="h-44"
          />
        </div>
        {error && (
          <p className={errorAdmin} role="alert">
            {error}
          </p>
        )}
        <div className={accionesAdmin}>
          {categoria && (
            <button
              type="button"
              className={botonPeligro}
              onClick={() => setConfirmando(true)}
              disabled={enviando}
            >
              Eliminar
            </button>
          )}
          <button
            type="submit"
            className={`${botonPildora} min-w-[130px]`}
            disabled={enviando}
          >
            {enviando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
      {confirmando && categoria && (
        <Confirmar
          titulo="Eliminar categoría"
          textoAccion="Sí, eliminar"
          onCerrar={() => setConfirmando(false)}
          onConfirmar={eliminar}
        >
          ¿Eliminar la categoría <strong>{categoria.nombre}</strong>? Esta acción no se puede deshacer.
          {categoria.cantidad_productos > 0 && " Primero hay que mover o eliminar sus productos."}
        </Confirmar>
      )}
    </Modal>
  );
}

/* ---------- Productos de una categoría ---------- */

function ProductosDeCategoria({ categoriaId }: { categoriaId: number }) {
  // La categoría sale de la lista que ya está en caché (no hace falta otra petición)
  const categorias = useDatos("categorias", cargarCategorias);
  const categoria = {
    datos: categorias.datos?.find((c) => c.id === categoriaId) ?? null,
    cargando: categorias.cargando,
    error: categorias.error,
  };
  const productos = useDatos(claveProductos(categoriaId), cargarProductos(categoriaId));
  const [editando, setEditando] = useState<Producto | "nuevo" | null>(null);

  return (
    <AdminLayout
      titulo={categoria.datos?.nombre ?? "Productos"}
      acciones={
        <button
          type="button"
          className={`${botonPildora} min-w-[200px]`}
          onClick={() => setEditando("nuevo")}
        >
          Añadir producto
        </button>
      }
    >
      <Link
        to="/admin/productos"
        className={`${enlaceDorado} -mt-3 mb-[18px] inline-block text-[15px]`}
      >
        ← Todas las categorías
      </Link>
      {(productos.cargando || categoria.cargando) && <Cargando />}
      {categoria.error && <MensajeError texto={categoria.error} />}
      {productos.error && (
        <MensajeError texto={productos.error} reintentar={productos.recargar} />
      )}
      {productos.datos?.length === 0 && (
        <Vacio texto="Esta categoría no tiene productos todavía." />
      )}
      <div className={gridTarjetas}>
        {productos.datos?.map((p) => (
          <TarjetaAdmin
            key={p.id}
            imagen={p.imagen_url || postreEjemplo}
            titulo={p.nombre}
            subtitulo={`${formatoPrecio(p.precio)} · ${ETIQUETA_DISPONIBILIDAD[p.disponibilidad]}`}
            onEditar={() => setEditando(p)}
          />
        ))}
      </div>
      {editando && (
        <FormProducto
          producto={editando === "nuevo" ? null : editando}
          categoriaId={categoriaId}
          onCerrar={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            productos.recargar();
            categorias.recargar(); // cambia la cantidad de productos de cada categoría
          }}
        />
      )}
    </AdminLayout>
  );
}

function FormProducto({
  producto,
  categoriaId,
  onCerrar,
  onGuardado,
}: {
  producto: Producto | null;
  categoriaId: number;
  onCerrar: () => void;
  onGuardado: () => void;
}) {
  const categorias = useDatos("categorias", cargarCategorias);
  const etiquetas = useDatos("etiquetas", cargarEtiquetas);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [imagen, setImagen] = useState<CambioImagen>(undefined);
  const [confirmando, setConfirmando] = useState(false);

  const ejecutar = async (mensaje: string, accion: () => Promise<unknown>) => {
    setEnviando(true);
    setError(null);
    try {
      await accion();
      avisar(mensaje);
      onGuardado();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setEnviando(false);
    }
  };

  const guardar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    ejecutar(producto ? "Producto guardado" : "Producto creado", async () => {
      const body = {
        nombre: String(f.get("nombre")).trim(),
        descripcion: String(f.get("descripcion")).trim(),
        precio: String(f.get("precio")),
        imagen_url: await resolverImagen(imagen, producto?.imagen_url ?? null),
        disponibilidad: f.get("disponibilidad") as Disponibilidad,
        categoria_id: Number(f.get("categoria_id")),
        etiquetas: f.getAll("etiquetas").map(String),
      };
      return producto
        ? api(`/productos/${producto.id}`, { method: "PATCH", body })
        : api("/productos", { method: "POST", body });
    });
  };

  const eliminar = async () => {
    if (!producto) return;
    await api(`/productos/${producto.id}`, { method: "DELETE" });
    avisar(`Producto “${producto.nombre}” eliminado`);
    onGuardado();
  };

  return (
    <Modal
      titulo={producto ? "Editar producto" : "Nuevo producto"}
      onCerrar={onCerrar}
    >
      <form className={formAdmin} onSubmit={guardar}>
        <label className={campoAdmin}>
          Nombre
          <input
            className={controlAdmin}
            name="nombre"
            required
            maxLength={150}
            defaultValue={producto?.nombre}
          />
        </label>
        <label className={campoAdmin}>
          Descripción
          <textarea
            className={controlAdmin}
            name="descripcion"
            rows={3}
            defaultValue={producto?.descripcion}
          />
        </label>
        <div className={filaAdmin}>
          <label className={campoAdmin}>
            Precio
            <input
              className={controlAdmin}
              name="precio"
              type="number"
              min={0}
              step="0.01"
              required
              defaultValue={producto?.precio}
            />
          </label>
          <label className={campoAdmin}>
            Disponibilidad
            <select
              className={controlAdmin}
              name="disponibilidad"
              defaultValue={producto?.disponibilidad ?? "stock"}
            >
              {(Object.keys(ETIQUETA_DISPONIBILIDAD) as Disponibilidad[]).map(
                (d) => (
                  <option key={d} value={d}>
                    {ETIQUETA_DISPONIBILIDAD[d]}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
        <label className={campoAdmin}>
          Categoría
          <select
            className={controlAdmin}
            name="categoria_id"
            defaultValue={producto?.categoria_id ?? categoriaId}
            key={categorias.datos?.length}
          >
            {categorias.datos?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <div className={campoAdmin}>
          Imagen
          <SubirImagen imagenInicial={producto?.imagen_url} onChange={setImagen} />
        </div>
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1.5 font-ui text-[13px] leading-[1.2] font-semibold text-tinto-texto">
            Etiquetas
          </legend>
          {etiquetas.datos?.map((e) => (
            <label
              key={e.id}
              className={`${chipFiltro} inline-flex cursor-pointer items-center gap-1.5 px-2.5 has-checked:border-tinto has-checked:bg-tinto has-checked:text-white`}
            >
              <input
                type="checkbox"
                className="accent-tinto"
                name="etiquetas"
                value={e.nombre}
                defaultChecked={producto?.etiquetas.includes(e.nombre)}
              />
              {nombreEtiqueta(e.nombre)}
            </label>
          ))}
        </fieldset>
        {error && (
          <p className={errorAdmin} role="alert">
            {error}
          </p>
        )}
        <div className={accionesAdmin}>
          {producto && (
            <button
              type="button"
              className={botonPeligro}
              onClick={() => setConfirmando(true)}
              disabled={enviando}
            >
              Eliminar
            </button>
          )}
          <button
            type="submit"
            className={`${botonPildora} min-w-[130px]`}
            disabled={enviando}
          >
            {enviando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
      {confirmando && producto && (
        <Confirmar
          titulo="Eliminar producto"
          textoAccion="Sí, eliminar"
          onCerrar={() => setConfirmando(false)}
          onConfirmar={eliminar}
        >
          ¿Eliminar <strong>{producto.nombre}</strong> del catálogo? Esta acción no se puede deshacer.
        </Confirmar>
      )}
    </Modal>
  );
}

/* ---------- Tarjeta (Figma 37:649) ---------- */

function TarjetaAdmin({
  imagen,
  titulo,
  subtitulo,
  onAbrir,
  onPrecargar,
  onEditar,
}: {
  imagen: string | null;
  titulo: string;
  subtitulo: string;
  onAbrir?: () => void;
  onPrecargar?: () => void;
  onEditar: () => void;
}) {
  return (
    <article
      className={`${tarjetaCrema} flex h-[250px] flex-col overflow-hidden`}
    >
      {onAbrir ? (
        <button
          type="button"
          className="group block overflow-hidden"
          onClick={onAbrir}
          onMouseEnter={onPrecargar}
          onFocus={onPrecargar}
          aria-label={`Abrir ${titulo}`}
        >
          <Foto src={imagen} />
        </button>
      ) : (
        <Foto src={imagen} />
      )}
      <div className="flex flex-1 items-center justify-between gap-2 pr-3 pl-[22px]">
        <div className="min-w-0">
          <h2 className="truncate font-ui text-[19px] leading-[1.25] font-semibold text-tinto-texto uppercase">
            {titulo}
          </h2>
          <p className="font-ui text-xs leading-[1.3] font-semibold text-dorado-texto">
            {subtitulo}
          </p>
        </div>
        <button
          type="button"
          className="flex-none rounded-lg hover:brightness-[0.92]"
          onClick={onEditar}
          aria-label={`Editar ${titulo}`}
        >
          <img
            className="size-[38px]"
            src={botonEditar}
            width={52}
            height={52}
            alt=""
          />
        </button>
      </div>
    </article>
  );
}

const foto =
  "h-44 w-full flex-none object-cover transition-transform duration-200 group-hover:scale-[1.03]";

function Foto({ src }: { src: string | null }) {
  return src ? (
    <img className={foto} src={src} alt="" loading="lazy" />
  ) : (
    <div className={`${foto} bg-linear-135 from-chip to-caramelo`} />
  );
}
