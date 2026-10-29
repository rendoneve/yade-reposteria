# Back-end · Repostería

Microservicios con **FastAPI** (Python 3.15) y **una sola base de datos PostgreSQL en Neon**,
con un *schema* por servicio. El front-end solo habla con el **gateway**.

| Servicio | Puerto | Schema | Qué hace |
|---|---|---|---|
| servicio-gateway | 8000 | — | Única entrada (`/api/...`), CORS, reenvía a cada servicio |
| servicio-auth | 8001 | `auth` | Login, registro de clientes, JWT, usuarios |
| servicio-catalogo | 8002 | `catalogo` | Categorías, productos, etiquetas, reseñas |
| servicio-citas | 8003 | `citas` | Citas en sucursal |
| servicio-negocio | 8004 | `negocio` | Nombre, logo, hero, banner, textos, WhatsApp, ubicación, horarios |
| servicio-actividad | 8005 | `actividad` | Historial de actividad y estadísticas del panel |

## Arranque

1. **Base de datos**: ejecuta `db/schema.sql` en el SQL Editor de Neon (se puede repetir sin problema).
2. **Configuración**: copia `.env.example` como `.env` aquí en `back-end/` y llénalo
   (cadena de Neon, `JWT_SECRET`, `INTERNAL_API_KEY` y el administrador inicial).
3. **Dependencias** (una vez por servicio, o cuando cambie el `pyproject.toml`):
   ```powershell
   cd servicio-auth;      uv sync; cd ..
   cd servicio-catalogo;  uv sync; cd ..
   cd servicio-citas;     uv sync; cd ..
   cd servicio-negocio;   uv sync; cd ..
   cd servicio-actividad; uv sync; cd ..
   cd servicio-gateway;   uv sync; cd ..
   ```
4. **Levantar todo**: `.\iniciar-backend.ps1` (abre una ventana por servicio).
   O uno solo: `cd servicio-catalogo; uv run python -m fastapi dev app/main.py --port 8002`
5. Revisa `http://localhost:8000/health`: todos deben decir `ok`.

## Imágenes (bucket)

Las imágenes de categorías y productos se suben desde el panel con el componente `SubirImagen`:
el front-end manda el archivo a `POST /api/imagenes` (servicio-catalogo), el servicio lo guarda en el
bucket y devuelve `{ "url": "..." }`, que es lo que se guarda en `imagen_url`.

Funciona con cualquier almacenamiento **compatible con S3**. Para conectarlo, llena en `back-end/.env`:

| Variable | Qué va |
|---|---|
| `S3_ENDPOINT_URL` | Endpoint S3 del proveedor (vacío si es AWS S3) |
| `S3_REGION` | Región (`auto` si el proveedor no usa regiones) |
| `S3_BUCKET` | Nombre del bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Credenciales con permiso de escritura |
| `S3_PUBLIC_URL` | URL pública del bucket, sin `/` al final. La imagen queda en `<S3_PUBLIC_URL>/imagenes/<id>.<ext>` |

El bucket debe permitir **lectura pública** para que el sitio pueda mostrar las imágenes.
Mientras `S3_BUCKET` esté vacío, `POST /api/imagenes` responde 503. Formatos: JPG, PNG, WEBP, GIF y AVIF, de hasta 5 MB.

Documentación interactiva (Swagger) de cada servicio: `http://localhost:800X/docs`.
Para probar endpoints de administrador en Swagger: haz login en `:8001/docs`
(`POST /auth/login`), copia `access_token` y pégalo en el botón **Authorize** del servicio.

## Endpoints (vía gateway, prefijo `http://localhost:8000/api`)

🔓 = público · 👤 = cualquier usuario con sesión (cliente o administrador) · 🔒 = solo administradores

**Auth**
- 🔓 `POST /auth/login` `{ "usuario": "usuario o correo", "password": "..." }` → `access_token`, `usuario` (con `rol`)
- 🔓 `POST /auth/registro` `{ "nombre_completo", "username", "correo", "password", "telefono"? }` → crea un **cliente** y devuelve `access_token`
- 👤 `GET /auth/me` · `PATCH /auth/me` · `PUT /auth/me/password` `{ "actual", "nueva" }`
- 🔒 `GET/POST /usuarios` · `GET/PATCH/DELETE /usuarios/{id}`

**Catálogo**
- 🔓 `GET /categorias` (incluye `cantidad_productos`) · `GET /categorias/{id}`
- 🔒 `POST /categorias` · `PATCH/DELETE /categorias/{id}` (no borra si tiene productos)
- 🔓 `GET /productos?categoria_id=&etiqueta=&disponibilidad=&q=&limit=&offset=` · `GET /productos/{id}` · `GET /productos/count`
- 🔓 `GET /productos/destacados?limit=4` ("más vendidos" o, si no hay, los más recientes) ·
  `GET /productos/opciones` (solo `id`, `nombre`, `categoria_nombre`: para selects)
- 🔒 `POST /productos` · `PATCH/DELETE /productos/{id}`
  (`etiquetas` es una lista de nombres: `["mas vendidos", "sin azucar"]`)
- 🔓 `GET /etiquetas` · 🔒 `POST /etiquetas` · `DELETE /etiquetas/{id}`
- 🔓 `GET /resenas?producto_id=` · `GET /resenas/{id}` · 🔒 `POST /resenas` · `PATCH/DELETE /resenas/{id}`
  (`producto_ids` es una lista: una reseña puede hablar de varios productos)
- 👤 `GET /resenas/mias` · `POST /resenas/mias` `{ "cita_id", "descripcion" }` — solo sobre una cita **propia y terminada**,
  una vez por cita; queda ligada a la cita y a sus productos (se valida con servicio-citas por HTTP)

**Citas**
- 🔓 `GET /citas/disponibilidad?fecha=2026-11-05` → horas libres de ese día (`franjas: [{inicio, disponible}]`).
  Si el negocio no ha configurado horarios responde `configurado: false` y el sitio deja escoger cualquier hora.
- 🔓 `POST /citas` — formulario del sitio; la fecha debe ser futura, llevar zona horaria, caer dentro del
  horario del negocio y no encimarse con otra cita (si no: 422 / 409)
  (`2026-11-05T16:00:00-07:00`). Siempre queda en estado `proximo`. Acepta `producto_ids` (se validan con
  servicio-catalogo y se guarda su nombre). Si va con token, la cita queda en la cuenta del cliente.
- 👤 `GET /citas/mias` · `PATCH /citas/mias/{id}/cancelar` (solo si está `proximo` y su fecha no ha pasado)
- 🔒 `GET /citas?estado=&tipo_servicio=&desde=&hasta=&q=&limit=&offset=` (header `X-Total-Count` con el total;
  orden: primero las que vienen y luego las pasadas) · `GET /citas/proximas/count` · `GET /citas/terminadas/count` · `GET /citas/resumen` (panel)
- 🔒 `POST /citas/admin` (captura del administrador) · `GET/PATCH/DELETE /citas/{id}` · `PATCH /citas/{id}/estado`

**Negocio**
- 🔓 `GET /negocio` (incluye horarios) · `GET /horarios`
- 🔒 `PATCH /negocio` · `PUT /horarios` `[{ "dia_semana": 1, "abre": "09:00", "cierra": "19:00" }, { "dia_semana": 0, "cerrado": true }]`

**Actividad**
- 🔒 `GET /actividades?tipo=&persona=&limit=&offset=`
- 🔒 `GET /estadisticas` → `productos_en_catalogo`, `inventario`, `citas_proximas`, `citas_terminadas`, `citas_siguientes`, `actividad_reciente`, `errores`
- `POST /actividades` es interno (header `X-Internal-Key`); el gateway lo bloquea desde afuera.
- `GET /citas/interno/{id}` también es interno (lo usa servicio-catalogo para validar reseñas).

Valores permitidos: disponibilidad `bajo pedido | stock | proximamente` ·
tipo de cita `especial | individual | pasteles` o el nombre de una categoría del catálogo · estado `proximo | cancelado | en proceso | terminado`.

## Cómo está organizado cada servicio

```
servicio-x/
  pyproject.toml
  app/
    main.py          # crea la app e incluye los routers
    core/            # config (.env), database, security (JWT), errores, cliente de actividad
    models.py        # tablas (SQLAlchemy)
    schemas.py       # lo que entra y sale de la API (Pydantic)
    repository.py    # consultas a la base de datos
    routers/         # endpoints
```

## Reglas

- Ningún servicio lee tablas de otro schema: si necesita datos, los pide por HTTP.
- El JWT lo firma `servicio-auth`; los demás solo lo verifican con el mismo `JWT_SECRET`.
  Lleva el `role` (`admin` o `cliente`): los endpoints de administración rechazan a los clientes con 403.
- Los cambios (crear, editar, eliminar) se registran solos en `servicio-actividad`.
  Si ese servicio está caído, la operación igual se completa.
- No hay migraciones: si cambias un modelo, actualiza `db/schema.sql` y agrega el
  `ALTER TABLE ...` a `ACTUALIZACIONES` en `app/core/database.py` del servicio (se aplica al arrancar).
- Las imágenes se guardan como URL (`imagen_url`, `banner_url`); el front las reduce a WebP de máx. 1600 px antes de subirlas.

## Rendimiento y conexión a la base de datos

- Cada ida y vuelta a Neon cuesta ~100-200 ms (la BD está en `us-east-2`). Por eso:
  - **Sin ping por petición**: solo se hace `SELECT 1` si la conexión estuvo ociosa más de 30 s.
    `pool_recycle=240` la descarta antes de que Neon suspenda el cómputo.
  - **Sin `db.refresh()`**: los modelos usan `eager_defaults` y el `INSERT/UPDATE ... RETURNING` trae id y fechas.
  - **Caché en memoria** (60 s, se vacía al guardar cambios): `/negocio`, `/horarios`, `/categorias`,
    `/etiquetas` y las listas de productos sin búsqueda. Una visita normal al sitio casi no toca Neon.
  - El gateway comprime con gzip las respuestas de más de 1 KB.
- **No usar el modo autocommit de pg8000** para ahorrar el BEGIN/ROLLBACK: se probó y con peticiones
  simultáneas mezcla las respuestas entre conexiones.
- Si se despliega, conviene usar la cadena **pooled** de Neon (host con `-pooler`) y poner el backend en la
  misma región que la base de datos.

## Límite de intentos (gateway)

Por IP: 10 logins por minuto, 5 cuentas nuevas por hora y 10 citas públicas por hora (responde 429).
Se cambian con las variables `LIMITE_*` del `.env`. Los contadores viven en memoria: se reinician con el gateway.

## Notas técnicas

- Driver **pg8000** (100 % Python): se instala en Python 3.15 sin compilar nada.
  `app/core/database.py` adapta la cadena de Neon (`sslmode`, `channel_binding`) automáticamente.
- Contraseñas con PBKDF2-SHA256 (librería estándar), 600 000 iteraciones.
- Neon suspende la base de datos por inactividad: la primera petición después de un rato tarda un poco más.
