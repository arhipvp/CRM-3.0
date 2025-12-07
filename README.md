# CRM 3.0 Skeleton

Monorepo с Django 5 + DRF в `backend/` и React 19 + Vite в `frontend/`. `scripts/` содержит вспомогательные задачи (импорт данных, преобразовани€, бэкапы).

## Backend

1. `cd backend`
2. `python -m venv .venv` и `.venv\Scripts\activate` (Windows) или `source .venv/bin/activate` (Unix)
3. `pip install -r requirements.txt`
4. `cp .env.example .env`
5. ”становите значени€ переменных (`DJANGO_SECRET_KEY`, `DJANGO_DB_*`, `GOOGLE_DRIVE_*` и т.п.)
6. `python manage.py migrate`
7. `python manage.py runserver`

API доступно по `http://localhost:8000/api/v1`. `GET /health/` провер€ет состо€ние сервера, `docs/` и `redoc/` дают доступ к OpenAPI.

### ѕримеры команд

- `python manage.py test apps/clients`
- `python manage.py check --deploy`
- `python manage.py loaddata ...` дл€ фикстур

## Frontend

1. `cd frontend`
2. `npm install`
3. `cp .env.example .env`
4. ”становите `VITE_API_URL=http://localhost:8000/api/v1/`
5. `npm run dev` (Vite на `http://localhost:5173`)

ƒл€ сборки: `npm run build`. Ћинтинг выполн€етс€ через `npm run lint` (`eslint.config.js`).

## Docker Compose

1. ѕри необходимости пробросить Postgres на хост убедитесь, что `.env` (или `.env.production`) определ€ет `POSTGRES_HOST_PORT=5435`; Compose использует эту переменную (`${POSTGRES_HOST_PORT:-5435}:5432`) дл€ маппинга внешнего порта.
2. `docker compose up --build`

 онтейнеры:
- Postgres: хостовый порт `${POSTGRES_HOST_PORT:-5435}` -> контейнерный `5432` (DJANGO_DB_PORT в `.env*/backend/.env` должен оставатьс€ `5432`, потому что Django общаетс€ с контейнером на стандартном порту)
- Backend: `http://localhost:8000/`
- Frontend: `http://localhost:5173/` (Vite проксирует API через `VITE_API_URL`)

## ќбщие скрипты

- `scripts/import_business_data.py`/`scripts/import_clients.py` Ч импорт клиентов/сделок/полисов из Excel; поддерживают `--sheet`, `--dry-run`, `--clear`.
- `scripts/full_import.sh` Ч перезаливка клиентов, сделок, полисов, платежей из дампов `/transform_{clients,deals}.py` и Excel (принимает `--backup-sql`, `--backup-xlsx`, `--env-file`).
- `scripts/backup_project_to_drive.py` Ч архив репозитори€, дампы Postgres/Excel и копирование Google Drive.
- `scripts/fix_mojibake.py` Ч исправление mojibake в `.ts/.tsx/.js/.jsx` файлах через `ftfy`.
- `transform_clients.py`/`transform_deals.py` Ч генераци€ SQL/JSON по экспортам `COPY public.client` и `COPY public.deal`.

## јвтоматический бэкап на Google Drive

- `scripts/backup_project_to_drive.py` архивирует проект (исключа€ `.git`, `node_modules`, `media`, `frontend/dist`), создаЄт SQL и Excel дампы (`database-dumps`) и копирует `GOOGLE_DRIVE_ROOT_FOLDER_ID` в `drive-files`.
- Ќастройте `.env`/`backend/.env` с `DJANGO_DB_*`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE`, `GOOGLE_DRIVE_BACKUP_FOLDER_ID`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
- ѕеременные:
  - `BACKUP_DB_EXCLUDE_TABLES` (comma-separated, default `users_auditlog`)
  - `BACKUP_MAX_SESSIONS` (default `2000`)
  - `BACKUP_DB_FALLBACK_HOST` Ч fallback host при недоступности `DJANGO_DB_HOST`
- «апуск: `python scripts/backup_project_to_drive.py [--project-root PATH] [--env-file PATH]`.
- ƒл€ регул€рной работы установите systemd unit/timer `crm3-drive-backup.{service,timer}` и выполните:
  ```sh
  sudo systemctl daemon-reload
  sudo systemctl enable --now crm3-drive-backup.timer
  ```

## CI/CD и деплой

- `.github/workflows/deploy.yml` Ч на `master` подключаетс€ к VPS (`VPS_HOST`, `VPS_USER`), делает `git reset --hard origin/master`, `docker compose -f docker-compose.prod.yml --env-file .env.production pull && up --build -d`.
- ѕеред деплоем добавьте секреты: `VPS_SSH_KEY`, `VPS_USER`, `VPS_HOST`, `VPS_PATH`.
- Ќа сервере: репозиторий в `/root/crm3`, `.env.production` содержит реальные секреты, `docker compose` запускаетс€ с `POSTGRES_HOST_PORT=5435` (DJANGO_DB_PORT остаЄтс€ `5432`).
- ƒл€ другой ветки обновите `on.push.branches` и целевой `git reset`.

## “есты и проверки

- Backend: `python manage.py test`, `python manage.py check --deploy` перед релизом.
- Frontend: `npm run lint`, `npm run build`, `npm run dev`.
- —крипты: `python scripts/backup_project_to_drive.py --help`, `python transform_clients.py --help` и т.д. Ч провер€ют параметризацию.

## ѕолезные ссылки

- `.env.example` и `backend/.env.example` показывают нужные переменные.
- `docker-compose.yml` поднимает Postgres (хостовой порт `POSTGRES_HOST_PORT`, по умолчанию 5435), backend и Vite.
- `scripts/templates/business_data_template_new.xlsx` Ч шаблон дл€ импорта клиентов/сделок/полисов/платежей.
EOF
