-- =====================================================================
--  Pastelería — Base de datos general (PostgreSQL / Neon)
-- ---------------------------------------------------------------------
--  Una sola base de datos, un SCHEMA por servicio:
--    auth       -> auth-service       (usuarios administradores)
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
    password_hash   VARCHAR(255) NOT NULL,          -- nunca la contraseña en texto plano (bcrypt)
    telefono        VARCHAR(20),
    rol             VARCHAR(20)  NOT NULL DEFAULT 'admin'
                    CHECK (rol IN ('admin')),
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

CREATE TABLE IF NOT EXISTS catalogo.resenas (
    id             SERIAL       PRIMARY KEY,
    nombre_cliente VARCHAR(100) NOT NULL,
    descripcion    TEXT         NOT NULL,
    fecha          DATE         NOT NULL DEFAULT CURRENT_DATE,
    producto_id    INTEGER      NOT NULL
                   REFERENCES catalogo.productos (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS ix_resenas_producto
    ON catalogo.resenas (producto_id);


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
    tipo_servicio  VARCHAR(20)  NOT NULL
                   CHECK (tipo_servicio IN ('especial', 'individual', 'pasteles')),
    estado         VARCHAR(20)  NOT NULL DEFAULT 'proximo'
                   CHECK (estado IN ('proximo', 'cancelado', 'en proceso', 'terminado')),
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Para GET /citas/proximas/count y para listar la agenda por fecha
CREATE INDEX IF NOT EXISTS ix_citas_estado_fecha
    ON citas.citas (estado, fecha);


-- =====================================================================
--  NEGOCIO-SERVICE
-- =====================================================================
-- Una sola fila (id = 1) con el contenido editable del sitio
CREATE TABLE IF NOT EXISTS negocio.negocio (
    id              SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    banner_url      VARCHAR(500),
    texto_principal TEXT,                 -- sección principal (hero)
    texto_acerca    TEXT,                 -- sección "Acerca de"
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

-- Primer administrador (opcional). Descomenta, cambia los datos y ejecútalo una vez.
-- Requiere la extensión pgcrypto (disponible en Neon). El hash bcrypt que genera
-- lo puede verificar auth-service con passlib/bcrypt.
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- INSERT INTO auth.usuarios (nombre_completo, username, correo, password_hash, telefono)
-- VALUES ('Administrador', 'admin', 'admin@pasteleria.com',
--         crypt('CambiaEstaContrasena', gen_salt('bf', 12)), NULL)
-- ON CONFLICT (username) DO NOTHING;
