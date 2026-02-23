# CRM 3.0

## Общий обзор
CRM 3.0 — связка Django 5 + DRF и React 19 + Vite с готовым Docker-окружением. Основной стек разделён на backend (доменные API, интеграции, бизнес-правила), frontend (SPA с контекстами и хуками), экспериментальный `frontend_example`, и инфраструктуру (Postgres, nginx, Docker). README-ы в каждом каталоге подробнее описывают соответствующую часть.

## Структура репозитория
| Каталог | Содержание |
| --- | --- |
| `backend/` | Django-проект: `config/` с настройками и роутингом, `apps/` с доменами (`clients`, `deals`, `tasks`, `notes`, `finances`, `documents`, `chat`, `policies`, `notifications`, `users`, `common`), вспомогательные скрипты и `tests/`. |
| `frontend/` | Vite + React + TypeScript: `src/` (api, components, hooks, contexts, utils, types), конфиги ESLint/TS, тесты (Vitest + Testing Library) и статические файлы в `public/`. |
| `frontend_example/` | Песочница для UI-идей и прототипов без влияния на основную сборку. |
| `docker-compose.yml`, `nginx.conf`, `.env*` | Сборка Postgres (порт 5435), backend, frontend и nginx; обмен переменными окружения и тома статики/медиа. |

## Основные блоки
### Backend
- **`config/`** содержит `settings.py` (разделённые конфиги по env), `api_router.py` (весь набор DRF-роутов), `urls.py`, `asgi.py`, `wsgi.py` и `admin.py`. Точка старта — `manage.py`.
- **`apps/common/`** держит повторно используемые сериализаторы, permissions, миксины, фильтры, подписчики сигналов и менеджеры. Именно сюда выносятся shared-бизнес-правила.
- **Доменные приложения (`clients`, `deals`, `tasks`, `notes`, `finances`, `documents`, `chat`, `policies`, `notifications`, `users`)** — модели, сериализаторы, ViewSet, filters, permissions и routers для каждой бизнес-функции. Новые эндпоинты добавляются через `api_router`.
- **`tests/`** проверяют поведение CRUD, permissions, сигналы и кодировку; они используют DRF APIClient и фикстуры в `conftest.py`.
- **Скрипты, миграции, миграции и интеграции**: `manage.py` управляет миграциями, сборкой статики, shell, loaddata; Google Drive и OpenAI-интеграции подключаются через env. Для Drive доступен `GOOGLE_DRIVE_AUTH_MODE=auto|oauth|service_account` (в `auto` OAuth используется первым, service account как fallback).

### Frontend
- **`src/main.tsx`, `App.tsx`, `AppContent.tsx`** — точка входа, маршруты и главный UI-контейнер. `AppContent` аккумулирует layout, контролирует загрузку начальных данных и обёртки контекстов.
- **`api/` и `src/api.ts`** обеспечивают HTTP-клиент, обработку ошибок и токенов (включая обновление JWT). Через них идут все запросы к `/api/v1`.
- **`components/`** содержит переиспользуемые визуальные блоки (карточки клиентов, таблицы сделок, формы фильтрации).
- **`hooks/` и `contexts/`** поддерживают состояние (например, `useAuth`, `useDealsFilter`, контексты auth/session) и управляют подписками на WebSocket/интервалами.
- **`utils/`, `types/` и `src/__tests__/`** — утилиты, типы и Vitest/Testing Library сценарии для компонентов и helpers.
- **Унификация переиспользования**: базовые примитивы форм/таблиц/alerts/modals лежат в `frontend/src/components/common/*`, confirm/prompt-потоки — в `frontend/src/hooks/useConfirm.ts` и `frontend/src/components/common/modal/PromptDialog.tsx`; подробности в `frontend/docs/component-reuse-audit.md`.
- **`public/`** хватка favicon, manifest, Robots, а `vite.config.ts` описывает прокси к backend и сборку.

### Инфраструктура
- **Docker**: `docker-compose.yml` запускает Postgres, backend, frontend и nginx; монтирует env-файлы и volume для static/media.
- **nginx** используется для отдачи статических файлов, кэширования и проксирования API к backend.
- **Автобэкап**: скрипт `scripts/backup_project_to_drive.py` и systemd-юниты `systemd/crm3-drive-backup.service`, `systemd/crm3-drive-backup.timer` (требуют настроенные env-переменные для Google Drive и доступа к БД; поддерживаются `GOOGLE_DRIVE_AUTH_MODE=auto|oauth|service_account`, `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, `GOOGLE_DRIVE_OAUTH_REFRESH_TOKEN`; лог по умолчанию пишется в `/root/crm3/cron-backup.log` согласно юниту).
- **Переменные окружения**: общий `.env`, `backend/.env` и `frontend/.env` (можно подключить `.env.production`, `.env.vps.secure`). Не коммитить реальные секреты.
- **Telegram-бот**: запускается отдельным процессом (`python manage.py run_telegram_bot`) и в `docker-compose.prod.yml` выделен сервис `telegram_bot`. Требует `TELEGRAM_BOT_TOKEN`, опционально `TELEGRAM_BOT_USERNAME` для deep-link и `CRM_PUBLIC_URL` для кликабельных ссылок на сделки; для фронтенда добавьте `VITE_TELEGRAM_BOT_USERNAME`, чтобы в настройках показывалась кликабельная ссылка на бота. Для переноса вложений в папку сделки используется внутренний backend API: задайте `TELEGRAM_INTERNAL_API_URL` (в Docker обычно `http://backend:8000`) и общий секрет `TELEGRAM_INTERNAL_API_TOKEN` (должен совпадать в `backend` и `telegram_bot`), опционально `TELEGRAM_INTERNAL_API_TIMEOUT_SECONDS`. Drive-креды (`GOOGLE_DRIVE_*`) остаются обязательными для `backend` (именно backend выполняет `ensure_deal_folder`/`upload_file_to_drive`), а для `telegram_bot` нужны только при fallback-режиме без internal API. Помимо уведомлений, поддерживает intake-сценарий в личном чате: принимает forwarded/обычные сообщения (`text`, `caption`, `photo`, `document`), объединяет несколько сообщений в один пакет, финализирует пакет после 60 секунд неактивности и затем предлагает выбор (inline-кнопки или команды `/pick`, `/create`, `/cancel`). Текст пакета сохраняется одной заметкой (`Note`), вложения из пакета — в `Document` и, при корректной настройке backend API/Drive, дублируются в папку сделки. Дедуп по `chat_id + message_id`, TTL сессии 30 минут. На старте бот автоматически синхронизирует Telegram-меню команд (`/help`, `/pick`, `/create`, `/cancel`) и пишет warning, если internal API/Drive-конфиг неполный. Deep-link вида `/deals?dealId=<uuid>` на фронтенде догружает сделку по ID даже если её нет на текущей странице пагинации.
  Мини-чеклист после деплоя: 1) `docker compose ps` показывает `crm3-telegram-bot` в `healthy`; 2) отправка 2-4 файлов в Telegram и выбор сделки возвращают `Сохранено файлов: N` без `Ошибки файлов`; 3) файлы видны в Google Drive папке сделки; 4) в логах нет `Unable to verify Drive folder`.

### Почта (mailcow)
- Почтовый стек разворачивается в подпапке `mailcow/` (submodule) и управляется через CI/CD.
- UI и API mailcow проксируются через наш `nginx` на поддомен `mail.zoom78.com`.
- Входящие письма читаются из CRM через IMAP (master user), отправка писем не используется.
- `docker-compose.prod.yml` использует внешнюю сеть `mailcow_mailcow-network` (её создаёт mailcow при первом запуске).

**DNS записи (делаются у регистратора домена):**
- `A` `mail.zoom78.com` → `173.249.7.183`
- `MX` `zoom78.com` → `mail.zoom78.com`
- `CNAME` `autodiscover.zoom78.com` → `mail.zoom78.com`
- `CNAME` `autoconfig.zoom78.com` → `mail.zoom78.com`

**PTR (reverse DNS):**
- Настраивается у провайдера VPS (Contabo), значение: `mail.zoom78.com`.

**Порты:**
- Должны быть открыты: `25, 465, 587, 143, 993, 110, 995, 4190` (SMTP/IMAP/POP/Sieve).

**GitHub Secrets для deploy.yml:**
- `MAILCOW_HOSTNAME` (пример: `mail.zoom78.com`)
- `MAILCOW_TZ` (пример: `Europe/Berlin`)
- `MAILCOW_ADMIN_EMAIL`
- `MAILCOW_ADMIN_PASS`
- `MAILCOW_API_KEY`
- `MAILCOW_API_ALLOW_FROM` (например: `127.0.0.1,173.249.7.183,172.22.1.0/24` для доступа backend-контейнера в mailcow-сети; workflow дополнительно гарантирует `127.0.0.1` и `172.22.1.0/24`)
- `MAILCOW_DOMAIN` (например: `zoom78.com`)
- `MAILCOW_IMAP_MASTER_USER`
- `MAILCOW_IMAP_MASTER_PASS`
- `MAILCOW_PROJECT_NAME` (по умолчанию `mailcow`)
- `MAILCOW_ADDITIONAL_SERVER_NAMES` (например: `autodiscover.zoom78.com,autoconfig.zoom78.com`)

**Сертификаты:**
- После добавления DNS нужно расширить сертификат для `mail.zoom78.com`, `autodiscover.zoom78.com`, `autoconfig.zoom78.com`.
- Сертификат хранится в `/etc/letsencrypt`, `nginx` подхватывает его через volume.

### Приложения Django
- `clients`: догоняет данные о клиентах (контакты, email, документы), хранит `Client` и связи с менеджерами.
- `deals`: сделки, расчёты (модели `Deal`, `Quote`, `InsuranceCompany`, `InsuranceType`, `SalesChannel`; в `Quote` есть флаги «Официальный дилер» и `GAP`), управление стадиями/статусами и Google Drive-метаданными (удаление файлов из таба «Файлы» — мягкое, через перемещение в подпапку `Корзина` внутри папки сделки).
- `deals/similar`: endpoint `POST /api/v1/deals/similar/` для подбора похожих сделок по score (`deal-sim-v1`) с ручным подтверждением объединения через существующий поток `merge/preview -> merge`.
- `policies`: страховые полисы, номера, статусы, VIN/бренд, связи с клиентами и каналами продаж, индексы по номеру и сделке.
- `finances`: платежи (`Payment`) и финансовые записи (`FinancialRecord`); платежи блокируются от удаления после реальной даты оплаты. Ведомости (Statement) считаются выплаченными по наличию даты выплаты `paid_at` (поле `status` не используется в бизнес-логике, оставлено для совместимости). Ведомости получают папки в Google Drive внутри `Ведомости/<Название>` и попадают в общий бэкап Drive.
- `tasks`: задачи и напоминания со статусами/приоритетами и чек-листами, привязанные к сделкам и пользователям.
- `documents`: хранит реальные файлы (`Document`); библиотечные блокноты и ответы обслуживаются через Open Notebook.
- `notes`: заметки по сделкам; `chat` — чаты/сообщения, `notifications` — уведомления для пользователей.
- `users`: роли (`Role`), права (`Permission`), связи с пользователями и журнал аудита (`AuditLog`).

### Авторизация (важно)
- Endpoints Open Notebook (knowledge) и `POST /api/v1/documents/recognize/` требуют JWT.
- `GET /api/v1/finances/summary/` требует JWT.

### Модель данных (основные связи)
- `Client` (из `clients`) связан с `Deal` и `Policy`; на основе клиента строятся документы, заметки и платежи.
- `Deal` играет центральную роль: связывается с `Client`, `Quote`, `Task`, `Document`, `Policy`, `Payment`, `Note` и `ChatMessage`; управляет стадиями, кандидатурой продавцов/исполнителей и датами контактов.
- `Policy` содержит номер, страховую компанию/тип, `SalesChannel`, даты начала/окончания и ссылку на страхователя в `client`; поле `insured_client` сохранено только как legacy для обратной совместимости. Удаление полиса очищает платежи.
- `Payment` объединён с `FinancialRecord` (доход/расход) и запрещает удаление после оплаты; хранит ссылку на сделку и полис.
- `Document` управляет файлами и метаданными (mime, checksum, owner), с загрузкой через `document_upload_path`.
- `Task`, `Notification`, `Note` и `ChatMessage` обеспечивают коммуникацию, напоминания и логирование событий внутри `Deal`.
- `users` и `notifications` контролируют доступ: роли -> permissions -> AuditLog, уведомления отображаются через `Notification`.

## Быстрый старт
```bash
# Backend
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env    # заполнить секреты и подключение к Postgres
python manage.py migrate
python manage.py runserver

# Frontend
cd frontend
npm install
npm run dev                # локальный Vite на localhost:5173 с прокси к backend
npm run build              # production-бандл
npm run preview            # превью собранного приложения
```

### Docker
```bash
docker compose up --build
```
Стек поднимает Postgres (порт 5435), Django, Vite и nginx; `VITE_PROXY_TARGET` (frontend) указывает на `http://backend:8000`. TLS/прокси/статики отрабатываются через `nginx.conf`.

## Проверки и workflow
- **Python**: `isort .` (учитывает `.isort.cfg`), затем `black .` (исключая папки `migrations` через `pyproject.toml`).
- **Frontend**: `npm run lint`, `npm run test`, `npm run build`.
- **Тесты**: `python manage.py test` проверяет DRF APIClient-слоты; `frontend/__tests__/` и `src/__tests__/` покрывают визуальные блоки и utils.
- **Перед PR** убедитесь, что `python manage.py test`, `npm run lint`, `npm run test` и `npm run build` проходят. Docker-compose можно использовать для интеграции.

## Безопасность секретов
- Реальные секреты храните только в локальных `.env`/секретах CI. В репозитории оставляйте только шаблоны (`backend/.env.example`, `frontend/.env.example`, `.env.production.example`).
- В `.gitignore` уже закрыты `.env` и локальные секретные файлы; перед добавлением новых env-файлов проверяйте, что они не попадают в индекс Git.
- Перед каждым коммитом запускайте pre-commit: `pre-commit run --all-files`. Конфигурация включает `detect-secrets` и блокирует утечки в изменённых файлах.
- В CI добавлен job `Secret Scan (changed files)`, который проверяет только изменённые файлы в push/PR, чтобы не требовать ретроспективной ротации текущих кредов.
- Перед merge делайте ручную проверку diff на секреты: `git diff --cached`.

## Ресурсы и контакты
- `AGENTS.md` — требования по кодировке, SSH-доступ, стандарты задавания секретов.
- `backend/README.md` и `frontend/README.md` — подробные инструкции по каждому сервису.
- `frontend_example/` — эксперименты и UI-прототипы, отдельно от production-бандла.
