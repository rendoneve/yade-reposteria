# Análisis del sistema · Yade Bakery

> **Actualización:** la mayoría de lo que propone este análisis ya está aplicado.
> Qué se cambió, cómo se probó y qué falta: ver `REPORTE-MEJORAS.md`.

> Fecha: 2026-10-28 · Alcance: `back-end/` (6 servicios FastAPI + `db/schema.sql`) y `front-end/` (React 19 + Vite + Tailwind 4).
> Enfoque principal: **conexión a la base de datos, cómo se traen los datos, cómo llegan al front y cómo hacerlo más rápido**.
> Después: qué está bien, qué mejoraría en back, front, diseño y experiencia de uso, y un plan priorizado.
>
> Nota: el análisis es de lectura de código + `pnpm build` / `pnpm lint`. No medí latencias reales contra Neon;
> los números de "idas y vueltas" son conteos sacados del código.

---

## 1. Resumen ejecutivo

El sistema está **bien organizado y es fácil de seguir**: cada servicio tiene la misma estructura
(`core/`, `models.py`, `schemas.py`, `repository.py`, `routers/`), los errores de BD se traducen a mensajes
entendibles, el front tiene un cliente de API único y tipado, y ya hay detalles de calidad poco comunes
(firma de imágenes verificada, login con tiempo constante, `lazy()` por página, reintentos ante Neon dormido).

Lo que más pesa en la **velocidad** hoy no es el código Python ni React, sino **cuántas idas y vueltas a Neon
hace cada petición** y que **el front no guarda nada en caché** (cada vez que cambias de página vuelve a pedir todo).

Las 5 mejoras con más impacto, en orden:

1. **Usar el endpoint *pooled* de Neon y la misma región** que el backend; quitar el `SELECT 1` extra por petición.
2. **Caché en el front** (TanStack Query o un `useDatos` con caché) + **caché HTTP** en `/negocio`, `/categorias`, `/etiquetas`.
3. **Cortar consultas sobrantes**: `db.refresh()` después de cada commit, la cascada de cargas en reseñas, los 3 conteos de citas.
4. **Validar la cita contra los horarios del negocio y contra choques de horario** (hoy no se valida en ningún lado).
5. **Optimizar imágenes** (los héroes pesan 700 KB y 490 KB en PNG; las fotos de productos se suben sin redimensionar).

---

## 2. Cómo viaja un dato hoy

```
Navegador ──HTTP──▶ Gateway :8000 ──HTTP──▶ servicio-X :800N ──TLS──▶ Neon (PostgreSQL)
  useDatos()          httpx.AsyncClient        SQLAlchemy + pg8000
  sin caché           sin caché / sin gzip     pool 2+3, pre_ping, refresh tras commit
```

Ejemplo real: **`GET /api/productos?categoria_id=3`** (pantalla de Catálogo)

| Paso | Idas y vueltas a Neon |
|---|---|
| `get_db()` → `session.connection()` con `pool_pre_ping=True` → `SELECT 1` | 1 |
| `SELECT productos JOIN categorias` (`lazy="joined"`) | 1 |
| `SELECT etiquetas … WHERE producto_id IN (…)` (`lazy="selectin"`) | 1 |
| **Total** | **3** |

Ejemplo: **`POST /api/productos`** (crear producto en el panel)

| Paso | Idas y vueltas |
|---|---|
| pre-ping | 1 |
| `db.get(Categoria)` para validar | 1 |
| buscar etiquetas por nombre | 1 |
| `INSERT producto` + `INSERT producto_etiqueta` + `COMMIT` | 2–3 |
| `db.refresh(p)` (vuelve a leer el producto + categoría) | 1 |
| recarga de etiquetas por `selectin` | 1 |
| **Total** | **≈ 7–8** |

Si Neon está en otra región que el backend, cada ida y vuelta puede costar decenas de milisegundos;
multiplicado por 3–8 es lo que se siente como "lento". Por eso las mejoras de la sección 3 van primero.

En **Catálogo** además hay una cascada en el front: primero se piden `/categorias`, y **solo cuando llegan** se piden
los productos (porque necesita saber cuál está seleccionada). Son dos viajes completos en serie.

---

## 3. Base de datos y conexión

### 3.1 Lo que está bien

- **Un schema por servicio** y la regla de "nadie lee tablas ajenas" está respetada en todo el código.
- `schema.sql` es **idempotente**, documentado y con `CHECK` que reflejan las reglas del negocio
  (estados, disponibilidad, `abre < cierra`, fila única en `negocio`).
- Índices pensados para las consultas reales: `ix_citas_estado_fecha`, `ix_citas_usuario (usuario_id, fecha DESC)`,
  `ix_actividades_fecha`, `ux_usuarios_correo (lower(correo))`, `ix_resena_producto_producto`.
- `pool_pre_ping` + `pool_recycle=180` + reintento en `get_db()` resuelven bien el problema de Neon dormido.
- `expire_on_commit=False` evita recargas innecesarias al leer atributos después del commit.
- Conteos en el servidor (`/productos/resumen`, `/citas/resumen`) en lugar de bajar todo al navegador.
- El panel (`/estadisticas`) consulta los servicios **en paralelo** con `asyncio.gather` y un `AsyncClient` reutilizado,
  y si uno falla el resto se muestra igual. Muy bien resuelto.

### 3.2 Conexión: qué cambiaría

**a) Usar el host *pooled* de Neon y la misma región.**
En el dashboard de Neon, "Connection pooling" da un host con `-pooler` (PgBouncer). Con 5 servicios × (2+3)
conexiones ya son hasta 25 conexiones directas; el pooler las multiplexa y abrir conexión nueva es mucho más barato.
Despliega el backend en la **misma región** que la BD (es la mejora más grande y no toca código).

**b) No pagar el `SELECT 1` en cada petición.**
Hoy `pool_pre_ping=True` + `session.connection()` en `get_db()` hacen un ping **por request**. Ya tienes reintento,
así que puedes confiar en él:

```python
# app/core/database.py
return create_engine(
    url,
    connect_args=connect_args,
    pool_pre_ping=False,   # el reintento de get_db() ya cubre conexiones cortadas
    pool_recycle=240,      # menor que la suspensión de Neon (5 min por defecto)
    pool_size=3,
    max_overflow=5,
    pool_use_lifo=True,    # reutiliza la conexión más "caliente"; las viejas se reciclan solas
)
```

Si prefieres no arriesgar, deja `pre_ping` pero entonces el `session.connection()` adelantado sobra: hace lo mismo.

**c) El código de `database.py`, `security.py` y `errores.py` está copiado 5 veces.**
Son idénticos salvo el `SCHEMA`. Un cambio (como el de arriba) hay que hacerlo en 5 archivos.
Con un **workspace de uv** se puede tener un paquete `back-end/comun/` y que cada servicio lo importe:

```toml
# back-end/pyproject.toml
[tool.uv.workspace]
members = ["comun", "servicio-*"]

# servicio-catalogo/pyproject.toml
dependencies = ["comun", ...]
[tool.uv.sources]
comun = { workspace = true }
```

**d) "Migraciones" al arrancar.**
`ACTUALIZACIONES` corre en cada arranque. En `servicio-auth` eso incluye
`DROP CONSTRAINT` + `ADD CONSTRAINT` sobre `auth.usuarios` **cada vez** (toma un lock exclusivo y revalida la tabla).
Además, si Neon no responde al arrancar, `actualizar_tablas()` no está en `try` y el servicio no levanta.
Opciones, de menor a mayor esfuerzo:
- Cambiar esas dos sentencias por un `DO $$ … IF NOT EXISTS (SELECT 1 FROM pg_constraint …)` para que no se repitan.
- Una tablita `public.schema_version` y aplicar solo lo pendiente.
- **Alembic** (lo recomendable cuando el proyecto crezca).

**e) Driver.** `pg8000` es 100 % Python porque Python 3.15 todavía no tiene ruedas de `psycopg[binary]`.
Funciona, pero es más lento serializando y no tiene pipeline. No es lo primero que atacaría (la red pesa más),
pero si en algún momento bajan a **Python 3.13/3.14**, `psycopg` 3 binario es un cambio de una línea en la URL
y también permitiría `uvloop`/`httptools` (que hoy se omiten por lo mismo que PyYAML).

**f) Llamadas entre servicios sin reutilizar conexiones.**
`registrar_actividad`, `obtener_cita` y `nombres_de_productos` abren un cliente HTTP nuevo en cada llamada.
Un cliente por módulo reutiliza conexiones keep-alive:

```python
# app/core/actividad.py
_http = httpx.Client(base_url=settings.actividad_service_url, timeout=3.0,
                     headers={"X-Internal-Key": settings.internal_api_key})

def registrar_actividad(persona: str, nombre: str, tipo: str) -> None:
    try:
        _http.post("/actividades", json={"persona": persona, "nombre": nombre, "tipo": tipo}).raise_for_status()
    except httpx.HTTPError as exc:
        log.warning("No se pudo registrar la actividad '%s': %s", nombre, exc)
```

Ojo también con la **dependencia circular** catálogo ⇄ citas (reseñas consultan citas, citas consultan productos):
si uno se cae, el otro pierde funciones. Hoy está bien manejado con 503, solo tenlo presente.

### 3.3 Consultas: qué sobra y cómo cortarlo

**a) `db.refresh()` después de cada `commit`** (todos los routers).
Con `expire_on_commit=False` los datos ya están en memoria; `refresh` solo hace falta para valores que pone la BD
(`id`, `created_at`, `fecha`). SQLAlchemy los puede traer en el mismo `INSERT … RETURNING`:

```python
class Producto(Base):
    __tablename__ = "productos"
    __mapper_args__ = {"eager_defaults": True}   # trae server_default con RETURNING
```

y quitar `db.refresh(p)`. Ahorra 1–2 idas y vueltas en cada alta/edición.

**b) Reseñas cargan medio catálogo.**
`Resena.productos` es `selectin` → cada `Producto` trae su `categoria` (`joined`) y sus `etiquetas` (`selectin`).
Para mostrar una reseña solo se usan `id` y `nombre` del producto. Ajustar la consulta:

```python
from sqlalchemy.orm import load_only, noload, selectinload

stmt = select(Resena).options(
    selectinload(Resena.productos).options(
        load_only(Producto.id, Producto.nombre),
        noload(Producto.categoria),
        noload(Producto.etiquetas),
    )
)
```

Pasa de ~4 consultas a 2 y transfiere mucho menos.

**c) Resumen de citas: 3 consultas → 2.**

```python
from sqlalchemy import func, select

fila = db.execute(select(
    func.count().filter(Cita.estado == "proximo", Cita.fecha >= func.now()),
    func.count().filter(Cita.estado == "terminado"),
)).one()
```

**d) Listas sin total → no se puede paginar bien.**
`/citas` (limit 200 en el panel) y `/productos` (limit 500 en catálogo/agendar) devuelven arreglos sin total.
Agregar un header `X-Total-Count` (o `{ items, total }`) y paginar en el panel.

**e) Endpoint ligero para selects.**
`AgendarCita` baja **todos los productos completos** (`limit=500`, con descripción, etiquetas, etc.) solo para llenar
un `<select>`. Un `GET /productos/opciones` que devuelva `id, nombre, categoria_nombre` es mucho más liviano.

**f) Índices que faltan o sobran**

| Índice | Por qué |
|---|---|
| `CREATE UNIQUE INDEX ux_usuarios_username ON auth.usuarios (lower(username))` | El login busca por `lower(username)`; el `UNIQUE` actual distingue mayúsculas y **no sirve para esa búsqueda**, y permitiría `Ana` y `ana`. |
| `CREATE INDEX ix_productos_categoria_fecha ON catalogo.productos (categoria_id, created_at DESC)` | Es exactamente el filtro + orden del catálogo. Reemplaza a `ix_productos_categoria`. |
| `pg_trgm` + GIN en `productos(nombre)` y `citas(nombre_cliente, telefono)` | Solo si crecen: `ILIKE '%texto%'` no usa índices normales. Con pocos cientos de filas no hace falta. |

**g) Valor por defecto peligroso.** `auth.usuarios.rol DEFAULT 'admin'`. Cualquier `INSERT` que olvide el rol crea un
administrador. Mejor `DEFAULT 'cliente'` y que `crear_usuario` ponga `rol="admin"` explícito.

### 3.4 Caché (la mejora "gratis" más grande)

Lo que se consulta en **todas** las páginas públicas y casi nunca cambia: `/negocio`, `/categorias`, `/etiquetas`,
y en menor medida `/productos`.

- **Header de caché HTTP** en esas respuestas públicas (el navegador ni siquiera llama al servidor durante 1 minuto):

  ```python
  @router.get("/negocio", response_model=NegocioOut)
  def ver_negocio(db: DB, response: Response):
      response.headers["Cache-Control"] = "public, max-age=60, stale-while-revalidate=600"
      return _out(db)
  ```

- **Caché en memoria** en `servicio-negocio` (una sola fila; se invalida en `PATCH /negocio` y `PUT /horarios`).
  Así ni siquiera toca Neon, y Neon puede dormirse sin que la portada lo note.
- **GZip en el gateway**: las listas JSON comprimen 70–85 %.

  ```python
  from fastapi.middleware.gzip import GZipMiddleware
  app.add_middleware(GZipMiddleware, minimum_size=1000)
  ```

---

## 4. Back-end (fuera de la BD)

### Lo que está bien
- Estructura idéntica en cada servicio, nombres en español claros, docstrings que explican el *por qué*.
- Gateway sencillo y seguro: bloquea `POST /actividades` desde afuera, quita `X-Internal-Key`, evita `..` en rutas,
  mensajes útiles (`'catalogo' es el nombre del servicio; no va en la URL…`).
- Seguridad bien pensada: PBKDF2 600k, `HASH_FALSO` para no revelar usuarios por tiempo, `compare_digest`,
  validación de firma de imágenes, cache inmutable en el bucket, 401 vs 403 bien usados.
- Actividad en `BackgroundTasks`: la respuesta no espera y si el servicio cae no rompe la operación.
- Validaciones con Pydantic muy completas (`AwareDatetime` para citas, patrones de teléfono, horarios coherentes).

### Lo que mejoraría

| Prioridad | Tema | Detalle |
|---|---|---|
| **Alta** | **Citas fuera de horario o encimadas** | `POST /citas` solo valida que la fecha sea futura. Se puede agendar un domingo cerrado a las 3 a.m., o 5 citas a la misma hora. Validar en `servicio-citas` contra `GET /horarios` (servicio-negocio, se puede cachear) y contra citas `proximo`/`en proceso` en esa franja. |
| **Alta** | **Sin límite de intentos** | `/auth/login`, `/auth/registro` y `POST /citas` (público) no tienen rate limit: fuerza bruta de contraseñas y spam de citas. Un límite simple por IP en el gateway (p. ej. `slowapi`, o un contador en memoria) basta. |
| Media | Usuario desactivado sigue entrando | Los servicios solo verifican el JWT; un admin desactivado conserva acceso hasta 2 h. Aceptable, pero conviene bajar la duración o que `require_admin` consulte un `/auth/interno/activo/{id}` cacheado. |
| Media | `.env.example` con `JWT_EXPIRE_MINUTES=` vacío | Si se copia tal cual, Pydantic intenta convertir `""` a entero y `servicio-auth` no arranca. Poner `120` en el ejemplo o `env_ignore_empty=True` en `Settings`. |
| Media | Sin pruebas | No hay ni una prueba automática. Empezar por las reglas de negocio: cancelar cita ajena, reseñar cita no terminada, borrar categoría con productos, login. `pytest` + `TestClient` + una BD de prueba (rama de Neon). |
| Baja | `DELETE` duros | Borrar un producto o una cita es irreversible. Un `activo`/`eliminado_en` evita perder historial. |
| Baja | Arranque en Windows/Linux | Hay 3 formas de levantar (`dev.mjs`, `dev.sh/.cmd`, `iniciar-backend.ps1`). `dev.mjs` ya cubre todo; el `.ps1` y el README podrían apuntar solo a ese. |

---

## 5. Front-end: cómo trae y muestra los datos

### Lo que está bien
- `lib/api.ts`: un solo punto de entrada, tipos que coinciden con los schemas, mensajes de error de FastAPI
  convertidos a texto entendible, timeout de 20 s, reintento en 502/503, deduplicación de GETs simultáneos,
  evento `sesion-expirada` en 401.
- `useDatos` con bandera `vigente` (evita respuestas viejas pisando nuevas).
- Sesión con usuario en caché en `localStorage` → la interfaz no parpadea al recargar.
- `ProveedorNegocio` carga `/negocio` una sola vez para todo el sitio.
- Páginas con `lazy()`: el JS inicial es 75 KB gzip y cada página 1.5–4.5 KB. Muy bien.
- Router propio de ~40 líneas, suficiente para este tamaño.
- React Compiler activado.

### Lo que mejoraría

**a) Caché de datos entre pantallas.** Hoy cada montaje de página vuelve a pedir todo: ir de Catálogo a Inicio y
regresar repite `/categorias`, `/etiquetas` y `/productos`. `MisCitas` y `MisResenas` piden ambas `/citas/mias` y
`/resenas/mias`. Recomiendo **TanStack Query** (≈13 KB gzip), que además reemplaza el truco de `GET_EN_CURSO`:

```tsx
// main.tsx
const cliente = new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, retry: 1 } } })
<QueryClientProvider client={cliente}><App /></QueryClientProvider>

// Catalogo.tsx
const categorias = useQuery({ queryKey: ['categorias'], queryFn: () => api<Categoria[]>('/categorias') })

// Después de guardar en el panel
cliente.invalidateQueries({ queryKey: ['productos'] })
```

Si no quieres otra dependencia, se puede dar a `useDatos` una clave y un `Map` de caché con "stale-while-revalidate":
muestra lo guardado al instante y refresca en segundo plano.

**b) Quitar la cascada en Catálogo.** Si la URL ya trae `?categoria=3`, pedir los productos **en paralelo** con las
categorías, sin esperar a que lleguen. Solo cuando no hay categoría en la URL hace falta esperar la primera.

**c) Inicio hace hasta 2 viajes en serie** (primero "mas vendidos" y, si viene vacío, los recientes). Mejor que el
backend tenga `GET /productos/destacados` que resuelva ese "si no hay, los recientes" en una sola consulta.

**d) Precargar al pasar el mouse.** Con TanStack Query, `onMouseEnter` en las categorías/links del menú →
`prefetchQuery`. La página siguiente abre ya con datos.

**e) Actualización optimista** en `admin/Citas` al cambiar el estado: hoy espera el PATCH y luego **recarga toda
la lista** (hasta 200 citas). Cambiar la fila al instante y revertir si falla.

**f) Imágenes**
- `hero-inicio.png` (694 KB) y `hero-catalogo.png` (492 KB), `postre-ejemplo.png` (148 KB): convertir a **WebP/AVIF**
  (quedan en ~60–120 KB) y al hero ponerle `fetchPriority="high"` (es lo primero que se ve).
- Las fotos que sube el admin llegan al bucket **tal cual, hasta 5 MB**, y se muestran en tarjetas de 260 px.
  Comprimir en el navegador antes de subir (canvas → WebP, máx. ~1600 px) es fácil y no necesita Pillow
  (que tampoco tendría ruedas para Python 3.15).
- Agregar `width`/`height` o `aspect-ratio` a las imágenes de productos para evitar saltos de contenido.

**g) Estados de carga.** "Cargando…" en texto hace que la página salte cuando llegan los datos. Unas tarjetas
*skeleton* del mismo tamaño que `TarjetaPostre` (362×260) se sienten mucho más rápidas.

**h) Calidad de código**
- `pnpm lint` **está roto**: `typescript-eslint does not support TS 7.0`. O bajar `typescript` a 5.x/6.x para el lint,
  o esperar una versión de `typescript-eslint` compatible. Hoy el lint no protege nada.
- `pages/Inicio.tsx` tiene 44 líneas de la versión anterior comentadas. Además `heroImagen` **siempre** tiene valor
  (cae a la imagen por defecto), así que la rama `else` nunca se ejecuta, y `relative` se repite con la clase `hero`.
- `front-end/README.md` y `README.md` de la raíz: el primero es la plantilla de Vite, el segundo está vacío.
- Token en `localStorage`: funciona y es común; el riesgo es que un XSS lo pueda leer. React escapa todo por defecto
  y no hay `dangerouslySetInnerHTML`, así que el riesgo es bajo. Si algún día se quiere más seguridad: cookie `HttpOnly`.

---

## 6. Diseño y experiencia de uso

### Lo que está bien
- Identidad visual consistente: paleta tinto/beige/dorado definida en `@theme`, 3 tipografías con rol claro
  (titulares, interfaz, texto), clases repetidas centralizadas en `lib/estilos.ts`.
- Buen trabajo de accesibilidad: `aria-pressed` en filtros, `aria-current` en el menú, `aria-label` en botones de ícono,
  `role="alert"`/`"status"`, `:focus-visible` visible, `<dialog>` nativo para modales (Esc funciona).
- Flujo de cliente bien hilado: agendar → (opcional) cuenta → ver/cancelar cita → reseñar cuando termina.
- La página de agendar precarga datos del usuario con sesión y el producto desde el que vino.

### Sitio público

| Mejora | Por qué |
|---|---|
| **Elegir horario de una lista**, no `datetime-local` libre | Mostrar días abiertos y horas disponibles (desde `horarios` y citas ya tomadas). Evita citas imposibles y es más fácil en celular. |
| Mostrar los horarios junto al formulario de agendar | Hoy solo están en "Acerca de". |
| Al confirmar la cita, botón **"Enviar por WhatsApp"** con mensaje prellenado | El negocio ya guarda el número; es el canal real del cliente. |
| **Vista de detalle del producto** (modal o página) | La tarjeta solo ofrece "Agendar cita". Falta ver descripción completa, foto grande, etiquetas y **reseñas** (el backend ya soporta `GET /resenas?producto_id=`). |
| Catálogo en celular: filtros en un panel desplegable "Filtros (2)" | Hoy en <760 px el aside entero queda **arriba** de los productos y hay que bajar mucho para ver postres. |
| Botón "Limpiar filtros" y contador "12 postres" | Hoy, si no hay resultados, no hay forma rápida de deshacer. |
| Buscador de texto en Catálogo | El backend ya tiene `?q=`. |
| Ortografía en la interfaz | "Menu", "Nuestro Catalogo", "LA VIDA MAS DULCE", "Categorias", "Telefono", "Proximos", "Citas proximas", "Configuracion", "Añadir Categoria". Para un negocio se nota. |
| SEO / compartir | No hay `<meta name="description">`, ni Open Graph (la vista previa al compartir por WhatsApp sale vacía), y el `<title>` es el mismo en todas las páginas. Poner `document.title` por página y metas OG en `index.html`. |

### Panel de administración

| Mejora | Por qué |
|---|---|
| **Confirmar antes de eliminar** categoría/producto | Hoy "Eliminar" borra al primer clic y es irreversible. |
| No cerrar el modal al hacer clic fuera si hay cambios | Se pierde lo escrito en el formulario de producto. |
| Avisos de éxito ("Producto guardado") | Hoy el modal solo se cierra; no hay confirmación visual. |
| Citas: filtro por fechas y vista "Agenda de hoy / semana" | El backend ya acepta `desde`/`hasta` pero el panel no lo usa. Para una repostería, ver el día es lo más útil. |
| Citas: orden por defecto "próximas primero" y paginación | En "Todos" se ordena por fecha ascendente: las citas más viejas salen arriba. |
| Teléfono como enlace `tel:` y botón de WhatsApp en cada cita | Un clic para contactar al cliente. |
| Confirmar al pasar una cita a "cancelado" | El `<select>` cambia el estado al instante; un error de dedo cancela la cita. |
| "Paquetes" y "Reseñas" (Próximamente) en el menú | Ocúltalos o márcalos como "pronto" en el menú. La moderación de reseñas ya existe en el backend: es lo siguiente fácil de terminar. |
| Tablas en celular → tarjetas | En <960 px las tablas hacen scroll horizontal; en celular se lee mejor una tarjeta por cita. |

### Contraste
- **Dorado `#99651c` sobre beige `#e8dccf` ≈ 3.7 : 1.** Pasa para títulos grandes, pero **no pasa AA (4.5 : 1)**
  en texto chico: encabezados de tabla (15 px), enlaces "Ver todo →", "Ir a productos →". Oscurecer el dorado
  para texto chico (p. ej. `#7d5214`, ≈ 5 : 1) y dejar el actual para títulos.
- Texto secundario `#6f6262` sobre crema ≈ 5 : 1 → bien.

---

## 7. Plan priorizado

### Rápido (≤ 1 día, alto impacto)
1. Host *pooled* de Neon + misma región que el backend.
2. `pool_pre_ping=False` / quitar el ping duplicado (en los 5 `database.py`).
3. `Cache-Control` en `/negocio`, `/categorias`, `/etiquetas` + `GZipMiddleware` en el gateway.
4. Convertir imágenes del hero a WebP + `fetchPriority="high"`.
5. Confirmación al eliminar en el panel.
6. Ortografía de la interfaz.
7. `JWT_EXPIRE_MINUTES=120` en `.env.example`; `rol DEFAULT 'cliente'`; índice `lower(username)`.

### Medio (1–3 días)
8. Validar citas contra horarios y choques (backend) + selector de horas disponibles (front).
9. TanStack Query (o caché en `useDatos`) y quitar la cascada en Catálogo.
10. Quitar `db.refresh()` con `eager_defaults`; optimizar carga de reseñas; resumen de citas en una consulta.
11. Rate limit en login, registro y `POST /citas`.
12. Compresión de imágenes antes de subir.
13. Arreglar `pnpm lint` y borrar el código comentado de `Inicio.tsx`.
14. Vista de detalle de producto con reseñas; filtros desplegables en celular.

### Más largo
15. Paquete `comun/` con workspace de uv (un solo `database.py`, `security.py`, `errores.py`).
16. Migraciones con Alembic (o tabla de versión) en lugar de `ACTUALIZACIONES` en cada arranque.
17. Pruebas automáticas de las reglas de negocio.
18. Agenda por día/semana en el panel, paginación con total, sección de reseñas.
19. SEO: títulos por página y Open Graph (o pre-render de Inicio/Catálogo).
