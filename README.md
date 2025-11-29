# CRM 3.0 Skeleton

Monorepo с backend на Django + DRF и frontend на React + Vite.

## Backend
1. `cd backend`
2. `python -m venv .venv && .venv\Scripts\activate`
3. `pip install -r requirements.txt`
4. `cp .env.example .env`
5. `python manage.py migrate`
6. `python manage.py runserver`

API доступно по адресу `http://localhost:8000/api/v1/`, `GET /health/` проверяет состояние сервера.

## Общая библиотека знаний
- `POST /api/v1/knowledge_documents/` (multipart/form-data) принимает файл, поле `title`/`description`, загружает документ в Google Drive и возвращает метаданные `web_view_link`, размеры и статистику.
- Загружаемые файлы сохраняются в папку из `GOOGLE_DRIVE_DOCUMENT_LIBRARY_FOLDER_ID`, дополнительно нужны `GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE` и `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
- Все пользователи могут читать и прикреплять документы; только админы имеют право обновлять и удалять записи, проверка роли уже встроена.

## Автоматический бекап на Google Drive
- `scripts/backup_project_to_drive.py` собирает репозиторий (без `.git`, `node_modules`, системных директорий) в архив `project-repo`, сельскохозяйственные дампы Postgres и Excel-таблицы (`database-dumps`), а также копирует `public`. Все упаковки помещаются в папку вида `crm3-backup-YYYYMMDD-HHMMSS` внутри `GOOGLE_DRIVE_BACKUP_FOLDER_ID`.
- Скрипт копирует содержимое `GOOGLE_DRIVE_ROOT_FOLDER_ID` в поддиректорию `CRM 3.0 Backup/Media/` (текущие файлы не удаляются, новые добавляются рядом).
- SQL-дампы создаются `pg_dump` на основе переменных `DJANGO_DB_*` из `.env`/`backend/.env`, Excel-таблицы формируются через `openpyxl`, каждая таблица получает файл `public`.
- Исключения таблиц задаются через `BACKUP_DB_EXCLUDE_TABLES` (например `users_auditlog`), они не попадают в SQL-дампы и Excel-списки.
- Параметр `BACKUP_MAX_SESSIONS` (по умолчанию `2000`) ограничивает количество сессий, заворачиваемых в `GOOGLE_DRIVE_BACKUP_FOLDER_ID` до актуального списка.
- В аварийной ситуации `BACKUP_DB_FALLBACK_HOST` позволяет попробовать подключиться к базе через pgcli, если основной `DJANGO_DB_HOST` недоступен.
- Запуск: `python scripts/backup_project_to_drive.py` (совместимо с `--project-root` и `--env-file`). Скрипт создаёт подпапки `project-repo`, `database-dumps` (sql + xlsx) и `drive-files`.
- Для регулярного выполнения установите unit `/etc/systemd/system/crm3-drive-backup.{service,timer}` и зафиксируйте конфигурацию:

```
sudo systemctl daemon-reload
sudo systemctl enable --now crm3-drive-backup.timer
```

Таймер с `OnCalendar=00,06,12,18:00:00` запускает сбор каждые 6 часов и логирует в `/root/crm3/cron-backup.log`. Альтернатива — cron-запись `0 3 * * * ...` через `crontab -e`.

## Frontend
1. `cd frontend`
2. `npm install`
3. `cp .env.example .env`
4. `npm run dev`

Интерфейс доступен по `http://localhost:5173/`, запросы направляются на `VITE_API_URL`.

## Docker Compose
1. Убедитесь, что в `backend/.env` сохранён нестандартный порт `DJANGO_DB_PORT=5435`.
2. `docker compose up --build`

Сервисы:
- Postgres: `5435`
- Backend: `http://localhost:8000/`
- Frontend (Vite): `http://localhost:5173/`

## CI/CD: GitHub Actions
- `.github/workflows/deploy.yml` при push в ветку `master` подключается к VPS по SSH (секреты ниже), выполняет `git reset --hard origin/master`, затем `docker compose -f docker-compose.prod.yml --env-file .env.production pull` и `up --build -d`.
- После деплоя workflow остаётся активно, чтобы исключить работу с локальными скриптами.

### Что нужно настроить для деплоя:
1. В репозитории GitHub перейдите в **Settings → Secrets and variables → Actions** и добавьте:
   - `VPS_SSH_KEY` (приватный ключ для доступа к VPS).
   - `VPS_USER` (`root` или нужный пользователь).
   - `VPS_HOST` (`173.249.7.183`).
   - `VPS_PATH` (`/root/crm3`).
2. На сервере убедитесь, что репозиторий уже существует (`/root/crm3`), `.env.production` содержит действительные секреты, и `git remote` указывает на правильный origin.
3. Если нужно деплоить из другой ветки, обновите триггеры workflow (`on.push.branches`) и контролируйте команды `git reset --hard origin/...`.

После пуша в `master` (или другой активированный workflow) GitHub Actions автоматически делает деплой, никаких дополнительных скриптов запускать не нужно.
