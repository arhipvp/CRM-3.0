# Build stage
FROM python:3.12-slim AS builder

WORKDIR /app

# Установка зависимостей системы для сборки
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Копируем requirements и устанавливаем зависимости Python
COPY backend/requirements.txt .
RUN pip install --user --no-cache-dir -r requirements.txt && \
    pip install --user gunicorn

# Final stage
FROM python:3.12-slim

WORKDIR /app

# Установка зависимостей для runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    netcat-traditional \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Копируем Python зависимости из builder
COPY --from=builder /root/.local /root/.local

# Добавляем path к Python зависимостям
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Копируем код приложения
COPY backend/ .

# Создаем директорию для статических файлов и медиа
RUN mkdir -p /app/staticfiles /app/media

# entrypoint.sh уже скопирован выше
RUN chmod +x /app/entrypoint.sh

# Expose порта
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import socket; socket.create_connection(('localhost', 8000), timeout=5)" || exit 1

# Default command - используется в docker-compose
ENTRYPOINT ["/bin/bash", "/app/entrypoint.sh"]
