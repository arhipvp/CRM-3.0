# Docker Setup для CRM 3.0

Полное руководство по запуску проекта через Docker Compose.

## 📋 Требования

- Docker ([установить](https://www.docker.com/products/docker-desktop))
- Docker Compose (идёт с Docker Desktop)
- 2GB свободной памяти (минимум)

## 🚀 Быстрый старт (3 команды)

```bash
# 1. Клонируем проект (если ещё не клонирован)
git clone <repository-url>
cd "C:\Dev\CRM 3.0"

# 2. Запускаем все сервисы
docker-compose up -d

# 3. Ждём инициализации (~30 сек) и готово!
# Backend доступен на http://localhost:8000
# База данных на localhost:5432
```

## 📚 Полная инструкция

### 1. Подготовка

```bash
# Перейти в корневую папку проекта
cd "C:\Dev\CRM 3.0"

# Скопировать .env.example (если нужно)
cp backend/.env.example backend/.env
```

### 2. Запуск сервисов

```bash
# Запустить все сервисы в фоне
docker-compose up -d

# Или с логами (для отладки)
docker-compose up
```

### 3. Проверка статуса

```bash
# Посмотреть статус контейнеров
docker-compose ps

# Просмотр логов
docker-compose logs backend    # логи Django
docker-compose logs db         # логи базы данных

# Следить за логами в реальном времени
docker-compose logs -f backend
```

### 4. Работа с базой данных

```bash
# Применить миграции (автоматически при запуске, но можно и вручную)
docker-compose exec backend python manage.py migrate

# Создать суперпользователя
docker-compose exec backend python manage.py createsuperuser

# Открыть shell Django
docker-compose exec backend python manage.py shell

# Подключиться к PostgreSQL
docker-compose exec db psql -U crm3 -d crm3
```

### 5. Доступ к приложению

```
Backend API:        http://localhost:8000
Admin Panel:        http://localhost:8000/admin
API Schema:         http://localhost:8000/api/schema/
Database:           localhost:5432 (user: crm3, password: crm3)
```

## 🛑 Остановка и удаление

```bash
# Остановить все контейнеры (данные сохранятся)
docker-compose stop

# Перезапустить контейнеры
docker-compose restart

# Удалить контейнеры и volumes (ВНИМАНИЕ: потеряются данные в БД!)
docker-compose down -v

# Удалить только контейнеры (volumes сохранятся)
docker-compose down
```

## 🔧 Кастомизация

### Изменение переменных окружения

Отредактируйте `backend/.env`:

```bash
# Например, для production:
DEBUG=False
DJANGO_SECRET_KEY=your-secret-key-here
ALLOWED_HOSTS=example.com,www.example.com
DJANGO_DB_PASSWORD=strong-password
```

### Изменение портов

В `docker-compose.yml`:

```yaml
services:
  backend:
    ports:
      - "8001:8000"  # Backend на порту 8001 вместо 8000
```

### Масштабирование (replicas)

```bash
# Запустить 3 копии backend (для load balancing)
docker-compose up -d --scale backend=3
```

## 📊 Структура контейнеров

```
crm3-db
├── PostgreSQL 16
├── Volume: postgres_data
└── Port: 5432

crm3-backend
├── Django + Gunicorn
├── Volumes: ./backend, backend_static, backend_media
├── Port: 8000
└── Зависит от: db
```

## 🐛 Решение проблем

### Проблема: "Address already in use"

```bash
# Порт уже используется. Либо измените портов в docker-compose.yml
# Либо остановите процесс, занимающий порт
netstat -lntp | grep 8000  # Найти процесс
kill -9 <PID>              # Убить процесс
```

### Проблема: "Connection refused" при подключении к БД

```bash
# Подождите пока база данных полностью инициализируется (30-60 сек)
# Проверьте здоровье контейнера
docker-compose ps

# Если статус "unhealthy", посмотрите логи
docker-compose logs db
```

### Проблема: "ModuleNotFoundError" при импортах

```bash
# Пересоберите image
docker-compose build --no-cache

# Заново запустите
docker-compose up -d
```

### Проблема: БД не мигрирована

```bash
# Примените миграции вручную
docker-compose exec backend python manage.py migrate

# Создайте суперпользователя
docker-compose exec backend python manage.py createsuperuser
```

### Проблема: Статические файлы не загружаются

```bash
# Собрать статические файлы
docker-compose exec backend python manage.py collectstatic --noinput

# Или пересоберите image
docker-compose build --no-cache backend
```

## 🔐 Production развёртывание

```bash
# 1. Обновите .env с production значениями
DEBUG=False
DJANGO_SECRET_KEY=<secure-random-key>
ALLOWED_HOSTS=yourdomain.com,www.yourdomain.com

# 2. Используйте Nginx reverse proxy
# 3. Настройте SSL (Let's Encrypt)
# 4. Используйте managed database вместо Docker PostgreSQL
# 5. Настройте backups и monitoring
```

## 📝 Полезные команды

```bash
# Посмотреть использование ресурсов
docker stats

# Очистить неиспользуемые images и volumes
docker system prune -a --volumes

# Просмотр конфига контейнера
docker-compose config

# Validation конфига
docker-compose config --quiet

# Обновить image (без .env)
docker-compose build --no-cache

# Войти в shell контейнера
docker-compose exec backend bash

# Запустить command в контейнере
docker-compose exec backend python manage.py createsuperuser

# Скопировать файл из контейнера
docker cp crm3-backend:/app/staticfiles ./backend/

# Просмотр истории изменений
docker-compose logs --tail=100 backend
```

## 🔄 CI/CD Pipeline (GitHub Actions)

Пример `.github/workflows/docker.yml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Build and push
        run: |
          docker-compose build
          docker tag crm3-backend:latest registry.example.com/crm3:latest
          docker push registry.example.com/crm3:latest
```

## 📖 Ссылки

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [PostgreSQL in Docker](https://hub.docker.com/_/postgres)
- [Django в Docker](https://docs.djangoproject.com/en/stable/howto/deployment/wsgi/gunicorn/)

## ❓ FAQ

**Q: Как сделать backup базы данных?**
```bash
docker-compose exec db pg_dump -U crm3 crm3 > backup.sql
```

**Q: Как восстановить БД из backup?**
```bash
docker-compose exec -T db psql -U crm3 crm3 < backup.sql
```

**Q: Как обновить приложение?**
```bash
git pull origin main
docker-compose build --no-cache
docker-compose up -d
```

**Q: Как просмотреть логи за последний час?**
```bash
docker-compose logs --since 1h backend
```

---

**Готово! Приложение запущено и готово к работе! 🎉**

Для первого входа в админ-панель используйте суперпользователя, созданного командой:
```bash
docker-compose exec backend python manage.py createsuperuser
```

Потом откройте http://localhost:8000/admin
