# Reporte de mejoras · Yade Bakery

> Fecha: 2026-10-28 · Complementa a `ANALISIS.md` (el diagnóstico inicial).
> Aquí está **qué se cambió, cómo se verificó, qué se midió y qué queda pendiente**.
> Nada está en un commit todavía: todos los cambios quedaron en el árbol de trabajo para que los revises.

---

## 1. Resumen

| Área | Antes | Ahora |
|---|---|---|
| Agendar una cita | **No funcionaba**: la tabla en Neon tenía una columna `codigo_resena NOT NULL` que el código nunca llena | Funciona. Además valida horario del negocio y que la hora no esté ocupada |
| Horas de la cita | Fecha y hora libres (se podía agendar un domingo cerrado a las 3 a.m.) | El cliente elige el día y ve solo las **horas disponibles** |
| Viajes a Neon por lectura | 5 (BEGIN, ping, consulta, consulta, ROLLBACK) | 4, y **0** en lo más visitado (caché en el servidor) |
| `/categorias` (2.ª visita en adelante) | ~500 ms | **~6 ms** (caché) |
| Datos en el front | Se volvían a pedir en cada cambio de pantalla | Caché compartida: lo ya cargado se muestra al instante y se refresca en segundo plano |
| Imágenes del diseño | 694 KB + 492 KB + 148 KB (PNG) | 125 KB + 111 KB + 12 KB (WebP) |
| Fotos que sube el admin | Hasta 5 MB tal cual | Se reducen a WebP de máx. 1600 px en el navegador antes de subir |
| `pnpm lint` | No corría (TypeScript 7) | Corre: **0 errores** (había 8 escondidos) |
| Login / registro / citas públicas | Sin límite de intentos | 10 logins/min, 5 cuentas/h, 10 citas/h por IP |
| Panel: borrar | Borraba al primer clic | Pide confirmación |
| Panel: reseñas | "Próximamente" | Pantalla de moderación funcionando |

---

## 2. Base de datos y conexión (el foco principal)

### 2.1 Problema grave encontrado y corregido

Al probar un `INSERT` real descubrí que **la base de Neon no coincide con el código**:
`citas.citas` tiene `codigo_resena VARCHAR NOT NULL` (con índice único) y `terminada_at`,
y existe una tabla `citas.resenas` vacía. Nada de eso está en `schema.sql` ni en ningún commit o rama
(busqué en `main`, `origin/David` y `origin/paquetes`). Consecuencia: **cualquier `POST /citas` fallaba**.

Corrección (en `servicio-citas/app/core/database.py`, se aplica sola al arrancar):
`ALTER TABLE citas.citas ALTER COLUMN codigo_resena DROP NOT NULL`, solo si la columna existe y es NOT NULL.
**No se borró ninguna columna ni dato**; si otro código usa esa columna, le sigue funcionando.
→ Pendiente: decidir con el equipo si esas columnas se quedan (y se agregan a `schema.sql`) o se eliminan.

### 2.2 Conexión (`app/core/database.py`, igual en los 5 servicios)

- **Ping solo para conexiones ociosas** (> 30 s). Antes se hacía `SELECT 1` en *cada* petición.
- `pool_recycle=240`: se descartan las conexiones antes de que Neon suspenda el cómputo (5 min).
- Pool un poco más grande (`3 + 5`) y `pool_use_lifo` (reutiliza la conexión más reciente).
- **Actualizaciones al arrancar más seguras**:
  - todas en una transacción (rápido) y, si alguna falla, una por una;
  - si Neon no responde, el servicio **arranca igual** y lo deja en el log (antes no levantaba);
  - `servicio-auth` ya no hace `DROP/ADD CONSTRAINT` sobre `usuarios` en cada arranque (bloqueaba la tabla).
- Archivos de configuración: una línea vacía en el `.env` ahora usa el valor por defecto
  (antes `JWT_EXPIRE_MINUTES=` vacío tumbaba `servicio-auth`).

> ⚠️ **Lo que probé y descarté**: usar el modo *autocommit* de pg8000 en los GET para ahorrar el
> BEGIN/ROLLBACK. Funciona con una petición a la vez, pero en la prueba de carga (10 en paralelo)
> **mezclaba respuestas entre conexiones** (llegaban nombres de producto donde se esperaban números).
> Lo quité y lo dejé documentado en el código para que nadie lo vuelva a intentar.

### 2.3 Consultas

| Cambio | Dónde | Efecto |
|---|---|---|
| `eager_defaults` + quitar `db.refresh()` | modelos de los 5 servicios | Cada alta/edición trae id y fechas en el mismo `INSERT … RETURNING`: 1-2 viajes menos por guardado (verificado: crear producto = `SELECT, INSERT, INSERT`, sin lecturas extra) |
| Reseñas cargan solo `id, nombre` del producto | `catalogo/repository.py` | Antes cada lista de reseñas traía la categoría y etiquetas de cada producto (2 consultas extra) |
| Conteos del panel en una sola consulta (`COUNT … FILTER`) | `citas/repository.py` | 3 consultas → 2 |
| Lista de citas del panel con total (`X-Total-Count`) y orden "próximas primero" | `citas/repository.py` | Permite paginar; antes salían primero las citas más viejas |
| `GET /productos/opciones` (id, nombre, categoría) | catálogo | Agendar ya no descarga el catálogo completo para llenar un `<select>` |
| `GET /productos/destacados` | catálogo | Inicio hacía hasta 2 peticiones en serie; ahora 1 |
| Índice `ix_productos_categoria_fecha (categoria_id, created_at DESC)` | catálogo | Exactamente el filtro + orden del catálogo (reemplaza al índice viejo) |
| Índice único `lower(username)` | auth | El login busca así; además evita `Ana` y `ana` a la vez |
| `rol` por defecto `'cliente'` (antes `'admin'`) | auth | Un `INSERT` sin rol ya no crea administradores |

Todo esto **ya está aplicado en tu base de Neon** (los servicios lo aplican al arrancar y lo verifiqué).

### 2.4 Caché

- **Servidor** (en memoria, 60 s, se vacía en cuanto el admin guarda algo):
  `/negocio`, `/horarios`, `/categorias`, `/etiquetas`, listas de productos sin búsqueda, destacados y opciones.
- **Gateway**: gzip en respuestas > 1 KB (`/negocio` pasó de 2009 a 983 bytes).
- **Front** (`src/lib/cache.ts` + `useDatos`): ver sección 4.

### 2.5 Medidas reales

Medido contra tu Neon (`us-east-2`) desde esta máquina; cada viaje cuesta ~100-200 ms:

| Prueba | Resultado |
|---|---|
| Viajes por lectura de productos | 5 → 4 (`BEGIN, SELECT, SELECT, ROLLBACK`) |
| `/categorias` primera vez → siguientes | ~500 ms → ~6 ms |
| Carga: 480 peticiones, 10 en paralelo | 480/480 OK, 0 errores |

---

## 3. Back-end (reglas de negocio y seguridad)

- **Agenda** (`servicio-citas`, archivos nuevos `core/agenda.py` y `core/negocio.py`):
  - La cita debe caer dentro del horario de ese día (hora local de Mazatlán) y terminar antes del cierre.
  - No se puede encimar con otra cita activa (`proximo` / `en proceso`). Dos personas no pueden apartar la
    misma hora al mismo tiempo (candado de transacción `pg_advisory_xact_lock`).
  - Máximo 180 días de anticipación.
  - Duración (30 min) y citas simultáneas (1) se cambian en el `.env` (`DURACION_CITA_MINUTOS`, `CITAS_SIMULTANEAS`).
  - Los horarios se piden a `servicio-negocio` y se guardan 1 min; si no responde se usan los últimos conocidos.
  - Si el negocio no ha configurado horarios (todos cerrados, como viene la BD nueva) no se restringe la hora.
  - Las citas que captura el administrador **no** se restringen (por si tiene que hacer una excepción).
  - Probado: 03:00 → 422 · 16:45 (cierra 17:00) → 422 · año 2027 → 422 · 10:15 con cita a las 10:00 → 409 · 10:30 → OK.
- **Nuevo** `GET /citas/disponibilidad?fecha=` para que el sitio muestre las horas libres.
- **Gateway**: límite de intentos por IP (probado: el intento 11 de login en un minuto → 429 "Espera 51 segundos…").
- Clientes HTTP entre servicios reutilizados (keep-alive) en vez de abrir conexión en cada llamada.
- `servicio-actividad` arranca aunque Neon no responda.
- Documentación: `back-end/README.md` (endpoints nuevos, rendimiento, límites) y `.env.example` (variables nuevas).

---

## 4. Front-end

### Datos
- `src/lib/cache.ts` + `useDatos(clave, cargar)`: caché compartida *stale-while-revalidate*.
  Volver a una pantalla es instantáneo; dos componentes que piden lo mismo comparten la petición;
  cualquier guardado marca todo como viejo; al entrar/salir de sesión se borra.
- `useNegocio` usa la misma caché (ya no hay un proveedor aparte con su propio `fetch`).
- **Catálogo**: si la URL ya dice la categoría, los productos se piden **junto** con las categorías (antes en serie);
  al pasar el mouse por una categoría se precarga.
- `apiPaginada()` lee `X-Total-Count`.

### Pantallas
- **Inicio**: una sola petición; esqueletos de carga en lugar de "Cargando…"; se quitaron 44 líneas de código
  comentado; se corrigió la condición del hero (la rama de "sin imagen" nunca se usaba).
- **Detalle de producto** (nuevo): al tocar la foto o el nombre se abre con foto grande, precio, etiquetas,
  descripción completa, **reseñas de ese postre** y botón para agendar.
- **Catálogo**: buscador (ignora acentos), contador de resultados, "Limpiar filtros"; en celular las
  categorías van en fila y los demás filtros se despliegan con un botón "Filtros (n)".
- **Agendar cita**: día + **horas disponibles** (las ocupadas se ven tachadas), horarios a un lado,
  lista ligera de productos, si la hora se ocupa mientras llenas el formulario se actualizan las horas,
  y al confirmar un botón **"Avisar por WhatsApp"** con el mensaje ya escrito.
- **Panel → Citas**: paginación con total, filtro por fechas y botón "Hoy", cambio de estado inmediato
  (se revierte si falla), confirmación al cancelar, teléfono que llama con un toque + botón de WhatsApp,
  tarjetas en celular en lugar de tabla con scroll.
- **Panel → Productos**: confirmación al eliminar categoría/producto, avisos "Producto guardado", precarga.
- **Panel → Reseñas** (nuevo): lista, búsqueda y eliminar con confirmación.
- **Panel → Inicio**: enlace "Ver todas" a las citas; "Paquetes" marcado como *Pronto* en el menú.
- **Mis citas / Mis reseñas**: comparten caché (pasar de una a otra ya no espera); avisos al cancelar/publicar.
- **Modales**: un clic fuera ya no cierra el formulario si escribiste algo.
- **Avisos** tipo *toast* (`src/lib/avisos.ts`, `components/Avisos.tsx`).

### Diseño, accesibilidad y SEO
- Ortografía: Menú, Nuestro catálogo, LA VIDA MÁS DULCE, Categorías, Teléfono, Próximas, Configuración,
  "Añadir categoría"; etiquetas "Más vendidos" / "Sin azúcar".
- Contraste: nuevo color `dorado-texto` (#7d5214, ≈5:1) para texto chico; el dorado original (≈3.7:1) queda para títulos grandes.
- Título de la pestaña por pantalla, `meta description` y Open Graph (vista previa al compartir por WhatsApp).
- Imágenes con `width/height`, `decoding="async"` y `fetchPriority="high"` en el hero.

### Calidad
- Lint: TypeScript 6 para el lint (typescript-eslint aún no soporta TS 7) y TypeScript 7 para el build
  (`package.json`: `typescript` ~6.0.3 y `typescript-7`). Se corrigieron los 8 errores que aparecieron.
- `lib/router.tsx` → `lib/router.ts` + `components/Link.tsx`; `lib/auth.tsx` + `lib/sesion.ts`;
  `lib/negocio.tsx` → `lib/negocio.ts` (cada `.tsx` exporta solo componentes: el *fast refresh* funciona bien).
- Bundle inicial: 238 KB → 227 KB (71.6 KB gzip).

---

## 5. Cómo se verificó

- `pnpm lint` (0 errores), `pnpm typecheck`, `pnpm build` ✔.
- Los 6 servicios importan y arrancan; `/health` todo `ok`.
- Escrituras probadas **dentro de transacciones que se deshicieron** (no quedó ningún dato de prueba).
- Prueba de carga 480 peticiones / 10 en paralelo: 0 errores (comparada contra el código original).
- Navegador real (Brave sin interfaz) en escritorio y 390 px: Inicio + detalle, Catálogo (+ filtros en celular),
  Agendar (elegir día y hora), Panel → Citas, Reseñas y Productos. Para el panel usé un token local
  firmado con tu `JWT_SECRET` y solo hice lecturas.

---

## 6. Pendientes

### Para que lo revises tú
1. **Columnas extra en Neon** (`codigo_resena`, `terminada_at`, tabla `citas.resenas`): ¿de quién son? Decidir si se quedan.
2. **Duración de cita y cupo**: dejé 30 min y 1 cita a la vez. Ajusta `DURACION_CITA_MINUTOS` / `CITAS_SIMULTANEAS` si no aplica.
3. **Tu entorno de desarrollo se detuvo** a mitad de mis pruebas (los 6 servicios y Vite). Vuelve a levantarlo con `./dev.sh`.
   Si Vite muestra "Failed to fetch dynamically imported module", recarga la página: es caché del servidor de
   desarrollo por los archivos renombrados (no pasa en el build).
4. Hacer commit (los `.webp` y archivos nuevos todavía no están en git).

### Siguientes mejoras (no se hicieron)
| Prioridad | Qué | Por qué |
|---|---|---|
| Alta | **Pruebas automáticas** (pytest + TestClient, una rama de Neon para pruebas) | Hoy todo se probó a mano; las reglas de agenda y de reseñas merecen pruebas |
| Alta | Cadena **pooled** de Neon y backend en la misma región al desplegar | Es la mayor ganancia que queda: cada viaje cuesta 100-200 ms desde aquí |
| Media | **Alembic** (migraciones) en lugar de `ACTUALIZACIONES` al arrancar | Evitaría diferencias como la de `codigo_resena` |
| Media | Paquete común (`uv workspace`) para `database.py`, `security.py`, `errores.py`, `actividad.py` | Hoy están copiados 5 veces (los mantuve idénticos) |
| Media | Usuario desactivado conserva acceso hasta que vence su token | Los servicios solo validan el JWT |
| Media | Caché y límites de intentos viven en memoria | Con varios procesos/servidores conviene Redis |
| Baja | Borrado lógico (`eliminado_en`) en productos y citas | Hoy borrar es irreversible |
| Baja | Driver `psycopg` 3 cuando haya ruedas para Python 3.15 | Más rápido que pg8000 y sin sus rarezas |
| Baja | Pantalla de Paquetes | Sigue como "Pronto" |
| Baja | Pre-render de Inicio/Catálogo para SEO | Es una SPA: Google ve poco contenido |
