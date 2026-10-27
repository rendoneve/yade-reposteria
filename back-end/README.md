# Back-end · Repostería

Microservicios con **FastAPI** (Python 3.15) y **una sola base de datos PostgreSQL en Neon**,
con un *schema* por servicio. El front-end solo habla con el **gateway**.

| Servicio | Puerto | Schema | Qué hace |
|---|---|---|---|
| servicio-gateway | 8000 | — | Única entrada (`/api/...`), CORS, reenvía a cada servicio |
| servicio-auth | 8001 | `auth` | Login, JWT, usuarios administradores |
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

🔓 = público · 🔒 = requiere `Authorization: Bearer <token>`

**Auth**
- 🔓 `POST /auth/login` `{ "usuario": "admin o correo", "password": "..." }` → `access_token`, `usuario`
- 🔒 `GET /auth/me` · `PATCH /auth/me` · `PUT /auth/me/password` `{ "actual", "nueva" }`
- 🔒 `GET/POST /usuarios` · `GET/PATCH/DELETE /usuarios/{id}`

**Catálogo**
- 🔓 `GET /categorias` (incluye `cantidad_productos`) · `GET /categorias/{id}`
- 🔒 `POST /categorias` · `PATCH/DELETE /categorias/{id}` (no borra si tiene productos)
- 🔓 `GET /productos?categoria_id=&etiqueta=&disponibilidad=&q=&limit=&offset=` · `GET /productos/{id}` · `GET /productos/count`
- 🔒 `POST /productos` · `PATCH/DELETE /productos/{id}`
  (`etiquetas` es una lista de nombres: `["mas vendidos", "sin azucar"]`)
- 🔓 `GET /etiquetas` · 🔒 `POST /etiquetas` · `DELETE /etiquetas/{id}`
- 🔓 `GET /resenas?producto_id=` · `GET /resenas/{id}` · 🔒 `POST /resenas` · `PATCH/DELETE /resenas/{id}`

**Citas**
- 🔓 `POST /citas` — formulario del sitio; la fecha debe ser futura y llevar zona horaria
  (`2026-11-05T16:00:00-07:00`). Siempre queda en estado `proximo`.
- 🔒 `GET /citas?estado=&tipo_servicio=&desde=&hasta=&q=` · `GET /citas/proximas/count` · `GET /citas/terminadas/count`
- 🔒 `POST /citas/admin` (captura del administrador) · `GET/PATCH/DELETE /citas/{id}` · `PATCH /citas/{id}/estado`

**Negocio**
- 🔓 `GET /negocio` (incluye horarios) · `GET /horarios`
- 🔒 `PATCH /negocio` · `PUT /horarios` `[{ "dia_semana": 1, "abre": "09:00", "cierra": "19:00" }, { "dia_semana": 0, "cerrado": true }]`

**Actividad**
- 🔒 `GET /actividades?tipo=&persona=&limit=&offset=`
- 🔒 `GET /estadisticas` → `productos_en_catalogo`, `citas_proximas`, `citas_terminadas`, `actividad_reciente`, `errores`
- `POST /actividades` es interno (header `X-Internal-Key`); el gateway lo bloquea desde afuera.

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
- Los cambios (crear, editar, eliminar) se registran solos en `servicio-actividad`.
  Si ese servicio está caído, la operación igual se completa.
- No hay migraciones: si cambias un modelo, actualiza `db/schema.sql` y agrega el
  `ALTER TABLE ...` a `ACTUALIZACIONES` en `app/core/database.py` del servicio (se aplica al arrancar).
- Las imágenes se guardan como URL (`imagen_url`, `banner_url`); subir archivos queda para después.

## Notas técnicas

- Driver **pg8000** (100 % Python): se instala en Python 3.15 sin compilar nada.
  `app/core/database.py` adapta la cadena de Neon (`sslmode`, `channel_binding`) automáticamente.
- Contraseñas con PBKDF2-SHA256 (librería estándar), 600 000 iteraciones.
- Neon suspende la base de datos por inactividad: la primera petición después de un rato tarda un poco más.
