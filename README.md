# CRM 3.0 Skeleton

Monorepo с Django 5 + DRF в `backend/` и React 19 + Vite в `frontend/`. `scripts/` содержит вспомогательные задачи (импорт данных, преобразования, бэкапы).

## Backend

1. `cd backend`
2. `python -m venv .venv` и `.venv\Scripts\activate` (Windows) или `source .venv/bin/activate` (Unix)
3. `pip install -r requirements.txt`
4. `cp .env.example .env`
5. Установите значения переменных (`DJANGO_SECRET_KEY`, `DJANGO_DB_*`, `GOOGLE_DRIVE_*` и т.п.)
6. `python manage.py migrate`
7. `python manage.py runserver`

API доступно по `http://localhost:8000/api/v1`. `GET /health/` проверяет состояние сервера, `docs/` и `redoc/` дают доступ к OpenAPI.

### Примеры команд

- `python manage.py test apps/clients`
- `python manage.py check --deploy`
- `python manage.py loaddata ...` для фикстур

## Frontend

1. `cd frontend`
2. `npm install`
3. `cp .env.example .env`
4. Установите `VITE_API_URL=/api/v1` - Vite проксирует запросы через `VITE_PROXY_TARGET`; при прямом обращении (без прокси) укажите `http://localhost:8000/api/v1/`.
5. `npm run dev` (Vite на `http://localhost:5173`)

Для сборки: `npm run build`. Линтинг выполняется через `npm run lint` (`eslint.config.js`).

## Docker Compose

1. При необходимости пробросить Postgres на хост убедитесь, что `.env` (или `.env.production`) определяет `POSTGRES_HOST_PORT=5435`; Compose использует эту переменную (`${POSTGRES_HOST_PORT:-5435}:5432`) для маппинга внешнего порта.
2. `docker compose up --build`

Контейнеры:
- Postgres: хостовый порт `${POSTGRES_HOST_PORT:-5435}` -> контейнерный `5432` (DJANGO_DB_PORT в `.env*/backend/.env` должен оставаться `5432`, потому что Django общается с контейнером на стандартном порту)
- Backend: `http://localhost:8000/`
- Frontend: `http://localhost:5173/` (Vite проксирует API через `VITE_API_URL`)

## Общие скрипты

- `backend/scripts/import_business_data.py` - импорт клиентов, сделок, полисов, платежей и задач из шаблона `scripts/templates/business_data_template_new.xlsx` (листы `clients`, `deals`, `policies`, `payments`, `incomes`, `expenses`, `tasks`, опции `--sheet`, `--dry-run`, `--clear`).
- `backend/scripts/populate_test_data.sh` - запускает `python manage.py shell < populate_test_data.py` внутри backend для посадки тестовых данных.
- `backend/scripts/reset_db.sh` - выполняет `python manage.py flush --no-input` и затем `python manage.py migrate`.
- `scripts/backup_project_to_drive.py` - архивирует проект, делает дампы Postgres/Excel и копирует в Google Drive с переменными `GOOGLE_DRIVE_*`.
- `scripts/fix_mojibake.py` - вызывает `ftfy` по списку файлов в `frontend`, используя `scripts/vendor/ftfy`.
- `scripts/templates/business_data_template_new.xlsx` - актуальный Excel-шаблон со листами для клиентов, сделок, полисов, платежей, доходов, расходов и задач.

## Автоматический бэкап на Google Drive

- `scripts/backup_project_to_drive.py` архивирует проект (исключая `.git`, `node_modules`, `media`, `frontend/dist`), создаёт SQL и Excel дампы (`database-dumps`) и копирует `GOOGLE_DRIVE_ROOT_FOLDER_ID` в `drive-files`.
- Настройте `.env`/`backend/.env` с `DJANGO_DB_*`, `GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE`, `GOOGLE_DRIVE_BACKUP_FOLDER_ID`, `GOOGLE_DRIVE_ROOT_FOLDER_ID`.
- Переменные:
  - `BACKUP_DB_EXCLUDE_TABLES` (comma-separated, default `users_auditlog`)
  - `BACKUP_MAX_SESSIONS` (default `2000`)
  - `BACKUP_DB_FALLBACK_HOST` - fallback host при недоступности `DJANGO_DB_HOST`
- Запуск: `python scripts/backup_project_to_drive.py [--project-root PATH] [--env-file PATH]`.
- Для регулярной работы установите systemd unit/timer `crm3-drive-backup.{service,timer}` и выполните:
  ```sh
  sudo systemctl daemon-reload
  sudo systemctl enable --now crm3-drive-backup.timer
  ```

## CI/CD и деплой

- `.github/workflows/deploy.yml` - на `master` подключается к VPS (`VPS_HOST`, `VPS_USER`), делает `git reset --hard origin/master`, `docker compose -f docker-compose.prod.yml --env-file .env.production pull && up --build -d`.
- Перед деплоем добавьте секреты: `VPS_SSH_KEY`, `VPS_USER`, `VPS_HOST`, `VPS_PATH`.
- На сервере: репозиторий в `/root/crm3`, `.env.production` содержит реальные секреты, `docker compose` запускается с `POSTGRES_HOST_PORT=5435` (DJANGO_DB_PORT остаётся `5432`).
- Для другой ветки обновите `on.push.branches` и целевой `git reset`.

## Тесты и проверки

- Backend: `python manage.py test`, `python manage.py check --deploy` перед релизом.
- Frontend: `npm run lint`, `npm run build`, `npm run dev`.
- Скрипты: `python scripts/backup_project_to_drive.py --help`, `python transform_clients.py --help` и т.д. - проверяют параметризацию.

## Документация и полезные ссылки

- `docs/DATA_TRANSFER.md` описывает маппинг полей из старой базы и последовательность импорта для `clients`, `deals`, `policies`, `payments`, `incomes`, `expenses`, `tasks`.
- `backend/README.md` содержит расширенную справку по Excel-импортам и вспомогательным скриптам, таким как `import_business_data.py`.
- `.env.example` и `backend/.env.example` показывают нужные переменные, включая ключи Google Drive и соединение Postgres.
- `docker-compose.yml` поднимает Postgres (хостовой порт `POSTGRES_HOST_PORT`, по умолчанию 5435), backend и Vite.
- `scripts/templates/business_data_template_new.xlsx` - шаблон для импорта клиентов/сделок/полисов/платежей.

## Стиль кода

- Форматирование Python регулируется `black` и `isort` (конфиги в `backend/pyproject.toml` и `.isort.cfg`). Обязательно прогоняйте `black` и `isort` перед коммитами.
- React/TypeScript код проверяется ESLint (`frontend/eslint.config.js`). Поддерживайте единый стиль по модулю и именованиям, как указано в конфиге.
