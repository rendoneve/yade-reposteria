import { useState, type FormEvent } from "react";
import botonEditar from "../../assets/img/boton-editar.png";
import postreEjemplo from "../../assets/img/postre-ejemplo.png";
import AdminLayout from "../../components/AdminLayout";
import { Cargando, MensajeError, Vacio } from "../../components/Estado";
import Modal from "../../components/Modal";
import SubirImagen from "../../components/SubirImagen";
import {
  api,
  ETIQUETA_DISPONIBILIDAD,
  resolverImagen,
  type CambioImagen,
  formatoPrecio,
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
import { Link, navegar, useRuta } from "../../lib/router";
import { useDatos } from "../../lib/useDatos";

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
  // En el orden en que se crearon
  const categorias = useDatos(() =>
    api<Categoria[]>("/categorias").then((l) =>
      [...l].sort((a, b) => a.id - b.id),
    ),
  );
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
          Añadir Categoria
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
        <Vacio texto="Aún no hay categorías. Crea la primera con “Añadir Categoria”." />
      )}
      <div className={gridTarjetas}>
        {categorias.datos?.map((c) => (
          <TarjetaAdmin
            key={c.id}
            imagen={c.imagen_url}
            titulo={c.nombre}
            subtitulo={`${c.cantidad_productos} ${c.cantidad_productos === 1 ? "elemento" : "elementos"}`}
            onAbrir={() => navegar(`/admin/productos/${c.id}`)}
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

  const guardar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    await ejecutar(async () => {
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
    await ejecutar(() =>
      api(`/categorias/${categoria.id}`, { method: "DELETE" }),
    );
  };

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setEnviando(true);
    setError(null);
    try {
      await accion();
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
              onClick={eliminar}
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
    </Modal>
  );
}

/* ---------- Productos de una categoría ---------- */

function ProductosDeCategoria({ categoriaId }: { categoriaId: number }) {
  const categoria = useDatos(
    () => api<Categoria>(`/categorias/${categoriaId}`),
    [categoriaId],
  );
  const productos = useDatos(
    () =>
      api<Producto[]>("/productos", {
        params: { categoria_id: categoriaId, limit: 500 },
      }),
    [categoriaId],
  );
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
          Añadir Producto
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
  const categorias = useDatos(() => api<Categoria[]>("/categorias"));
  const etiquetas = useDatos(() => api<Etiqueta[]>("/etiquetas"));
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [imagen, setImagen] = useState<CambioImagen>(undefined);

  const ejecutar = async (accion: () => Promise<unknown>) => {
    setEnviando(true);
    setError(null);
    try {
      await accion();
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
    ejecutar(async () => {
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

  const eliminar = () =>
    producto &&
    ejecutar(() => api(`/productos/${producto.id}`, { method: "DELETE" }));

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
              {e.nombre}
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
              onClick={eliminar}
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
    </Modal>
  );
}

/* ---------- Tarjeta (Figma 37:649) ---------- */

function TarjetaAdmin({
  imagen,
  titulo,
  subtitulo,
  onAbrir,
  onEditar,
}: {
  imagen: string | null;
  titulo: string;
  subtitulo: string;
  onAbrir?: () => void;
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
          <p className="font-ui text-xs leading-[1.3] font-semibold text-dorado">
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
