# Yade Repostería

Sitio y panel de administración de una repostería: catálogo de productos, agenda de citas,
reseñas, cuentas de clientes e información del negocio.

```
front-end/   React 19 + Vite + Tailwind (SPA)
back-end/    API Gateway + 5 servicios FastAPI (auth, catalogo, citas, negocio, actividad)
             sobre PostgreSQL (Neon), un esquema por servicio
```

## Cómo correrlo

1. `cp back-end/.env.example back-end/.env` y llena los valores (`DATABASE_URL`, `JWT_SECRET`,
   `INTERNAL_API_KEY`, el primer administrador y, si vas a subir imágenes, `S3_*`).
2. `./dev.sh` (Linux/macOS) o `dev.cmd` (Windows) levanta los 6 procesos del back y Vite.
3. Sitio en http://localhost:5173 · API (gateway) en http://localhost:8000/api.

Más detalle del back-end en [`back-end/README.md`](back-end/README.md).

## Pruebas

```
cd back-end
pip install -r requirements-test.txt
pytest
```

El CI (`.github/workflows/ci.yml`) corre las pruebas del back y `lint` + `build` del front.

## Seguridad: lo que hay que saber

- Cada servicio valida el JWT y, además, consulta a servicio-auth (con caché de 15 s) que la cuenta
  siga activa: desactivar a un usuario le quita el acceso en segundos.
- Solo el gateway debe ser accesible desde internet. Los servicios (8001-8005) confían en
  `X-Internal-Key` y en el JWT, pero no tienen límite de intentos ni de tamaño.
- Detrás de un proxy, activa `CONFIAR_X_FORWARDED_FOR=true` solo si el gateway no está expuesto directo.
- Las citas capturadas por el administrador siguen las reglas de agenda; `?forzar=true` las salta.

## Documentos del proyecto

- [`ANALISIS.md`](ANALISIS.md) y [`REPORTE-MEJORAS.md`](REPORTE-MEJORAS.md): base de datos, caché, rendimiento y diseño.
