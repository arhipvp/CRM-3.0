# CRM 3.0 Skeleton

Monorepo с backend на Django + DRF и frontend на React + Vite.

## Backend
1. `cd backend`
2. `python -m venv .venv && .venv\Scripts\activate`
3. `pip install -r requirements.txt`
4. `cp .env.example .env`
5. `python manage.py migrate`
6. `python manage.py runserver`

API: `http://localhost:8000/api/v1/`, health-check: `/health/`.

## Frontend
1. `cd frontend`
2. `npm install`
3. `cp .env.example .env`
4. `npm run dev`

Приложение доступно на `http://localhost:5173/` и взаимодействует с backend через переменную `VITE_API_URL`.

## Docker Compose
1. Убедитесь, что `backend/.env` содержит свободный `DJANGO_DB_PORT` (по умолчанию 5435).
2. Выполните `docker compose up --build`.

Сервисы:
- Postgres: порт `5435`.
- Backend: http://localhost:8000/
- Frontend (Vite): http://localhost:5173/

## Локальный скрипт деплоя

Чтобы пересобрать весь проект и скопировать код на VPS в один шаг, используй `./deploy.sh`.

```bash
# Сделай скрипт исполняемым (один раз)
chmod +x deploy.sh

# После изменений запускай:
./deploy.sh
```

Параметры можно переопределить через переменные окружения:

```bash
SSH_USER=deploy SSH_HOST=173.249.7.183 ./deploy.sh
```

Скрипт использует `rsync` (с `--delete`) и пропускает локальные артефакты/файлы окружения, затем на сервере вызывает `docker compose -f docker-compose.prod.yml --env-file .env.production up --build -d`. Убедись, что файл `/root/crm3/.env.production` уже настроен и содержит актуальные пароли/ключи.
