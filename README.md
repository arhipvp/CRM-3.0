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

## Shared Documentation Library

- `GET` and `POST` `/api/v1/knowledge_documents/` expose the shared knowledge documents; `POST` accepts a `file` part (multi-part form) plus optional `title`/`description`, uploads the file to Google Drive, and returns metadata with `web_view_link` and file stats.
- The Drive folder into which uploads land is configured via `GOOGLE_DRIVE_DOCUMENT_LIBRARY_FOLDER_ID` (in addition to the existing `GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE`/`GOOGLE_DRIVE_ROOT_FOLDER_ID` settings).
- All users can read and upload documents; only admins can update or delete entries (the endpoint already enforces the role check).

## Автоматический бэкап на Google Drive

- Скрипт `scripts/backup_project_to_drive.py` проходит по репозиторию, упаковывает файлы (без `.git`, `node_modules`, виртуальных окружений и сборок) в zip-архив `project-repo` и отправляет его, а также SQL-дамп Postgres и Excel-снимок бизнес-таблиц (`database-dumps`) в новую подпапку `crm3-backup-YYYYMMDD-HHMMSS` внутри `GOOGLE_DRIVE_BACKUP_FOLDER_ID`.
- Одновременно скрипт копирует содержимое `GOOGLE_DRIVE_ROOT_FOLDER_ID` (все клиентские/сделочные вложения) в подпапку `drive-files`, так что ничего не теряется при резервировании.
- Для создания SQL-файла требуется `pg_dump` (он рассчитывает на настройки `DJANGO_DB_*` из `.env`/`backend/.env`). Excel-отчёт формируется через `openpyxl`: каждая таблица схемы `public` получает свой лист.
- Необходимые переменные окружения: `GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE`, `GOOGLE_DRIVE_BACKUP_FOLDER_ID`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`, а также `DJANGO_DB_HOST/PORT/NAME/USER/PASSWORD`. Скрипт читает значения из `.env`, `backend/.env` и дополнительных `--env-file`.
- Если умеешь подключаться к базе через `localhost`/другой хост вне Docker-сети, задай `BACKUP_DB_FALLBACK_HOST` — при невозможности резолва `DJANGO_DB_HOST` скрипт переключится на fallback и попробует сделать дамп через PG-CLI.
- Запуск: `python scripts/backup_project_to_drive.py` (опционально `--project-root`, `--env-file`). Каждая сессия создаёт папку по шаблону `crm3-backup-YYYYMMDD-HHMMSS` и загружает внутрь `project-repo`, `database-dumps` (sql + xlsx) и `drive-files`.

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

## CI/CD: GitHub Actions

Деплой теперь автоматизирован через `.github/workflows/deploy.yml`: при `push` в ветку `master` GitHub Actions подключается к VPS по SSH (секреты см. ниже), делает `git reset --hard origin/master`, а потом `docker compose -f docker-compose.prod.yml --env-file .env.production pull` и `up --build -d`. После сборки очищается неиспользуемая картинка.

Перед тем как делать `push`, проверь, что `master` содержит актуальные изменения и что конфиг `.env.production` на сервере заполнен (пароли/ключи, `ALLOWED_HOSTS`, `VITE_API_URL`).

### Что нужно сделать тебе:

1. В репозитории на GitHub зайди в **Settings → Secrets and variables → Actions** и добавь:
   - `VPS_SSH_KEY` (приватный ключ, которым можно зайти на сервер);
   - `VPS_USER` (`root` или другой SSH-пользователь);
   - `VPS_HOST` (`173.249.7.183`);
   - `VPS_PATH` (`/root/crm3`).
2. Убедись, что на сервере уже есть репозиторий (`/root/crm3`), `.env.production` с секретами и что `git remote` правильно настроен (или сможешь вручную `git pull` оттуда).
3. Если нужно деплоить из другой ветки — просто обнови `on.push.branches` в workflow (и, при необходимости, соответствующий путь в `git reset --hard origin/...`).

После этих настроек достаточно пуша в `master` (или другой ветку, если перепишешь workflow), и GitHub Actions сделает всё остальное — без локальных скриптов.
