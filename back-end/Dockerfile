# Imagen base: Linux pequeño con Python 3.15
FROM python:3.15-slim

# Traer uv (el mismo que usas en Windows)
COPY --from=ghcr.io/astral-sh/uv:0.12.15 /uv /bin/uv

WORKDIR /app

# 1) Primero solo los archivos de dependencias
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# 2) Después el código
COPY app ./app

# Puerto en el que escucha el servicio DENTRO del contenedor
EXPOSE 8000

# Comando que se ejecuta al arrancar el contenedor
CMD ["uv", "run", "fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]