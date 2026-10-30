"""Variables mínimas para poder importar los servicios sin una base de datos real."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql+pg8000://u:p@localhost/db")
os.environ.setdefault("JWT_SECRET", "secreto-de-pruebas-" + "x" * 32)
os.environ.setdefault("INTERNAL_API_KEY", "clave-interna-de-pruebas")
