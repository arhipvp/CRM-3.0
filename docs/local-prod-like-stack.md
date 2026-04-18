# Локальный prod-like стенд

Этот сценарий поднимает локально production-подобный контур:

- `db` — PostgreSQL 16
- `backend` — Django/Gunicorn
- `telegram_bot` — отдельный long-polling процесс
- `frontend` — собранный Vite bundle в отдельном контейнере
- `nginx` — локальный reverse proxy для UI, API, `static/`, `media/`

## Что нужно подготовить

1. Скопировать шаблоны окружения:
   - `backend/.env.example` -> `backend/.env`
   - `frontend/.env.example` -> `frontend/.env` только для dev-mode Vite
2. Создать каталог `runtime-secrets/`.
3. Если используете Google Drive refresh token file, положить токен в:
   - `runtime-secrets/google_drive_oauth_refresh_token`
4. Заполнить секреты в `backend/.env`:
   - обязательно: `DJANGO_SECRET_KEY`
   - для AI: `OPENROUTER_API_KEY`
   - для Telegram: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_INTERNAL_API_TOKEN`
   - для Google Drive: `GOOGLE_DRIVE_*`
   - для mailcow: `MAILCOW_API_*`, `MAILCOW_IMAP_*`

## Запуск

```powershell
docker compose config
docker compose up --build -d
docker compose ps
```

Локальные порты по умолчанию:

- `http://localhost/` — UI через `nginx`
- `http://localhost/api/v1/` — API через `nginx`
- `http://localhost/health/` — backend health через `nginx`
- `http://localhost:8000/` — прямой прокси в backend
- `localhost:5435` — PostgreSQL на хосте

Если `80` занят, можно переопределить:

```powershell
$env:LOCAL_HTTP_PORT=8080
$env:LOCAL_BACKEND_PORT=8001
docker compose up --build -d
```

## Что проверять после старта

Core:

```powershell
docker compose ps
curl http://localhost/health/
docker compose exec backend python manage.py showmigrations
docker compose exec backend python manage.py check
docker compose exec backend python manage.py check_external_services
```

Backend tests:

```powershell
docker compose exec backend python manage.py test
```

Frontend build smoke:

```powershell
docker compose build frontend
```

## Локальный логин

Entrypoint backend автоматически создаёт superuser из:

- `DJANGO_SUPERUSER_USERNAME`
- `DJANGO_SUPERUSER_EMAIL`
- `DJANGO_SUPERUSER_PASSWORD`

После запуска можно войти в UI и в `admin/` этими данными.

## Как читать результат `check_external_services`

- `ok` — интеграция отвечает
- `missing` — конфиг не заполнен
- `error` — конфиг есть, но probe не прошёл

Для жёсткой проверки:

```powershell
docker compose exec backend python manage.py check_external_services --strict
```

## Dev-mode отдельно

Если нужен именно Vite dev server с hot reload, он остаётся отдельным удобным режимом и не является основным prod-like сценарием:

```powershell
cd frontend
npm install
npm run dev
```

В этом режиме `frontend/.env` используется напрямую, а `VITE_API_URL` обычно остаётся `/api/v1`.
