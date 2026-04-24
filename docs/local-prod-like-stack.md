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
   - для Telegram: `TELEGRAM_BOT_TOKEN`
   - для Google Drive: `GOOGLE_DRIVE_*`
   - для mailcow: `MAILCOW_API_*`, `MAILCOW_IMAP_*`
5. Подключить каталог с backup-данными:
   - backup root по умолчанию: `G:\Мой диск\CRM 3.0 Backup`
   - внутри него ожидаются каталоги `crm3-backup-*` и общий `Media`

## Основной сценарий данных: restore из backup

Основной способ наполнения локального стенда данными:

```powershell
python scripts/restore_local_backup.py
```

Скрипт автоматически:

- выбирает самый свежий `crm3-backup-*`
- находит внутри него `database-dumps/*.sql`
- копирует нужный SQL-дамп в `tmp/local-backup`
- зеркалирует `Media` в `tmp/local-media`, чтобы Docker Desktop гарантированно видел файлы даже если исходный `G:` — это Google Drive virtual FS
- останавливает app-сервисы
- поднимает `db`
- полностью пересоздаёт локальную БД
- восстанавливает SQL-дамп
- запускает `backend`, `telegram_bot`, `frontend`, `nginx`
- монтирует локальный staging `tmp/local-media` как `/media/...`

Полезные варианты:

```powershell
python scripts/restore_local_backup.py --snapshot crm3-backup-20260418-220018
python scripts/restore_local_backup.py --skip-media
```

Важно:

- локальная Postgres считается расходной и будет полностью перезаписана
- backup остаётся источником истины, но для Docker используется staging в `tmp/local-backup` и `tmp/local-media`
- данные в backup не анонимизированы; используйте этот режим только локально в закрытом контуре

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

Smoke после restore из backup:

```powershell
curl http://localhost/health/
curl -I http://localhost/
docker compose exec backend python manage.py shell -c "from django.contrib.auth import get_user_model; print(get_user_model().objects.count())"
```

Backend tests:

```powershell
docker compose exec backend python manage.py test
```

Fallback demo data:

```powershell
docker compose exec backend python manage.py seed_demo_data --replace --count 30
```

Команда остаётся только как запасной автономный dev-режим, если реальный backup недоступен. Если Google Drive не настроен, при сидировании возможны warning-логи от сигналов, но сами записи будут созданы.

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
