-- =====================================================================
--  Pastelería — Base de datos general (PostgreSQL / Neon)
-- ---------------------------------------------------------------------
--  Una sola base de datos, un SCHEMA por servicio:
--    auth       -> auth-service       (administradores y clientes)
--    catalogo   -> catalogo-service   (categorías, productos, etiquetas, reseñas)
--    citas      -> citas-service      (citas en sucursal)
--    negocio    -> negocio-service    (contenido del sitio y horarios)
--    actividad  -> actividad-service  (historial de actividad del panel)
--    gateway    -> NO tiene tablas (es Nginx, solo enruta)
--
--  Reglas:
--    * Ningún servicio hace JOIN ni FK hacia el schema de otro servicio.
--      Los datos de otro servicio se piden por HTTP.
--    * "Estadísticas" no es tabla: actividad-service las calcula
--      (count de productos, count de citas próximas, últimas actividades).
--    * "Cantidad de productos" de una categoría se calcula con COUNT.
--
--  Ejecutar en Neon (SQL Editor). Es idempotente: se puede repetir.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS catalogo;
CREATE SCHEMA IF NOT EXISTS citas;
CREATE SCHEMA IF NOT EXISTS negocio;
CREATE SCHEMA IF NOT EXISTS actividad;


-- =====================================================================
--  AUTH-SERVICE
-- =====================================================================
CREATE TABLE IF NOT EXISTS auth.usuarios (
    id              SERIAL       PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    username        VARCHAR(50)  NOT NULL UNIQUE,
    correo          VARCHAR(150) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,          -- nunca la contraseña en texto plano (PBKDF2-SHA256)
    telefono        VARCHAR(20),
    rol             VARCHAR(20)  NOT NULL DEFAULT 'admin'
                    CHECK (rol IN ('admin', 'cliente')),   -- cliente = cuenta creada desde el sitio
    activo          BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Correo único sin importar mayúsculas/minúsculas
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_correo
    ON auth.usuarios (lower(correo));


-- =====================================================================
--  CATALOGO-SERVICE   (coincide con app/models/catalogo.py)
-- =====================================================================
CREATE TABLE IF NOT EXISTS catalogo.categorias (
    id         SERIAL       PRIMARY KEY,
    nombre     VARCHAR(100) NOT NULL UNIQUE,
    imagen_url VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS catalogo.etiquetas (
    id     SERIAL      PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS catalogo.productos (
    id             SERIAL         PRIMARY KEY,
    nombre         VARCHAR(150)   NOT NULL,
    descripcion    TEXT           NOT NULL,
    precio         NUMERIC(10, 2) NOT NULL CHECK (precio >= 0),
    imagen_url     VARCHAR(500),
    disponibilidad VARCHAR(30)    NOT NULL DEFAULT 'stock'
                   CHECK (disponibilidad IN ('bajo pedido', 'stock', 'proximamente')),
    categoria_id   INTEGER        NOT NULL
                   REFERENCES catalogo.categorias (id) ON DELETE RESTRICT,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_productos_categoria
    ON catalogo.productos (categoria_id);

-- Un producto puede tener varias etiquetas ("nuevos" + "sin azucar", etc.)
CREATE TABLE IF NOT EXISTS catalogo.producto_etiqueta (
    producto_id INTEGER NOT NULL REFERENCES catalogo.productos (id) ON DELETE CASCADE,
    etiqueta_id INTEGER NOT NULL REFERENCES catalogo.etiquetas (id) ON DELETE CASCADE,
    PRIMARY KEY (producto_id, etiqueta_id)
);

-- Las captura el administrador o las deja un cliente sobre una de sus citas terminadas
CREATE TABLE IF NOT EXISTS catalogo.resenas (
    id             SERIAL       PRIMARY KEY,
    nombre_cliente VARCHAR(100) NOT NULL,
    descripcion    TEXT         NOT NULL,
    fecha          DATE         NOT NULL DEFAULT CURRENT_DATE,
    usuario_id     INTEGER,                         -- auth.usuarios (sin FK: otro servicio)
    cita_id        INTEGER                          -- citas.citas   (sin FK: otro servicio)
);

-- Una reseña por cita
CREATE UNIQUE INDEX IF NOT EXISTS ux_resenas_cita
    ON catalogo.resenas (cita_id);
CREATE INDEX IF NOT EXISTS ix_resenas_usuario
    ON catalogo.resenas (usuario_id);

-- Una reseña habla de uno o varios productos (los de la cita)
CREATE TABLE IF NOT EXISTS catalogo.resena_producto (
    resena_id   INTEGER NOT NULL REFERENCES catalogo.resenas (id) ON DELETE CASCADE,
    producto_id INTEGER NOT NULL REFERENCES catalogo.productos (id) ON DELETE CASCADE,
    PRIMARY KEY (resena_id, producto_id)
);

CREATE INDEX IF NOT EXISTS ix_resena_producto_producto
    ON catalogo.resena_producto (producto_id);


-- =====================================================================
--  CITAS-SERVICE
-- =====================================================================
CREATE TABLE IF NOT EXISTS citas.citas (
    id             SERIAL       PRIMARY KEY,
    fecha          TIMESTAMP WITH TIME ZONE NOT NULL,   -- día y hora de la cita
    nombre_cliente VARCHAR(100) NOT NULL,
    telefono       VARCHAR(20)  NOT NULL,
    correo         VARCHAR(150),
    detalles       TEXT,
    tipo_servicio  VARCHAR(100) NOT NULL,                -- especial | individual | pasteles | nombre de una categoría
    estado         VARCHAR(20)  NOT NULL DEFAULT 'proximo'
                   CHECK (estado IN ('proximo', 'cancelado', 'en proceso', 'terminado')),
    usuario_id     INTEGER,                              -- cliente con cuenta (auth.usuarios, sin FK)
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Para GET /citas/proximas/count y para listar la agenda por fecha
CREATE INDEX IF NOT EXISTS ix_citas_estado_fecha
    ON citas.citas (estado, fecha);

-- "Mis citas" del cliente
CREATE INDEX IF NOT EXISTS ix_citas_usuario
    ON citas.citas (usuario_id, fecha DESC);

-- Productos del catálogo que se piden en la cita (sin FK: otro servicio).
-- Se guarda el nombre al agendar para mostrarlo aunque el producto cambie o se borre.
CREATE TABLE IF NOT EXISTS citas.cita_productos (
    cita_id     INTEGER      NOT NULL REFERENCES citas.citas (id) ON DELETE CASCADE,
    producto_id INTEGER      NOT NULL,
    nombre      VARCHAR(150) NOT NULL,
    PRIMARY KEY (cita_id, producto_id)
);


-- =====================================================================
--  NEGOCIO-SERVICE
-- =====================================================================
-- Una sola fila (id = 1) con el contenido editable del sitio
CREATE TABLE IF NOT EXISTS negocio.negocio (
    id              SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    nombre          VARCHAR(100),         -- nombre del negocio (ej. Yade Bakery)
    logo_url        VARCHAR(500),
    hero_url        VARCHAR(500),         -- imagen del hero de Inicio
    banner_url      VARCHAR(500),         -- banner de "Acerca de"
    texto_principal TEXT,                 -- texto del hero de Inicio (una línea por renglón)
    texto_acerca    TEXT,                 -- historia del negocio
    whatsapp        VARCHAR(20),          -- ej. 5216681234567
    ubicacion       VARCHAR(255),         -- dirección escrita
    mapa_url        VARCHAR(500),         -- enlace de Google Maps (opcional)
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Horario por día de la semana (0 = domingo ... 6 = sábado)
CREATE TABLE IF NOT EXISTS negocio.horarios (
    dia_semana SMALLINT PRIMARY KEY CHECK (dia_semana BETWEEN 0 AND 6),
    abre       TIME,
    cierra     TIME,
    cerrado    BOOLEAN NOT NULL DEFAULT FALSE,
    CHECK (cerrado OR (abre IS NOT NULL AND cierra IS NOT NULL AND abre < cierra))
);


-- =====================================================================
--  ACTIVIDAD-SERVICE   (coincide con app/models/actividad.py)
-- =====================================================================
CREATE TABLE IF NOT EXISTS actividad.actividades (
    id      SERIAL       PRIMARY KEY,
    fecha   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    persona VARCHAR(100) NOT NULL,          -- username de quien la hizo
    nombre  VARCHAR(255) NOT NULL,          -- ej. "Nueva cita de Ana López"
    tipo    VARCHAR(30)  NOT NULL           -- nuevo, modificacion, eliminacion, ...
);

-- El panel muestra las más recientes primero
CREATE INDEX IF NOT EXISTS ix_actividades_fecha
    ON actividad.actividades (fecha DESC);


-- =====================================================================
--  DATOS INICIALES (no se duplican si se vuelve a ejecutar)
-- =====================================================================
INSERT INTO catalogo.etiquetas (nombre) VALUES
    ('mas vendidos'), ('nuevos'), ('sin azucar'), ('personalizados')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO negocio.negocio (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO negocio.horarios (dia_semana, cerrado) VALUES
    (0, TRUE), (1, TRUE), (2, TRUE), (3, TRUE), (4, TRUE), (5, TRUE), (6, TRUE)
ON CONFLICT (dia_semana) DO NOTHING;

-- Primer administrador: NO se inserta aquí. servicio-auth lo crea al arrancar
-- con ADMIN_USERNAME y ADMIN_PASSWORD del archivo back-end/.env (solo si no hay usuarios),
-- porque la contraseña se guarda cifrada con el formato propio del servicio.
