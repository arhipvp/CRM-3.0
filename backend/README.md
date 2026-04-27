# Backend (Django + DRF)

## Обзор
Backend — это одиночный Django-проект, распределённый по приложениям: каждый домен (`clients`, `deals`, `tasks`, `notes`, `finances`, `documents`, `chat`, `policies`, `notifications`, `users`) реализует модели, сериализаторы, permissions, ViewSet и роутер. Общие компоненты собираются в `apps/common`, а `config/` управляет настройками и маршрутизацией.

### Приложения и их назначение
- `clients`: `Client` содержит имя, телефон, email, дату рождения, заметки и связку с менеджером; служит источником для сделок и полисов.
- `deals`: `Deal`, `Quote`, `InsuranceCompany`, `InsuranceType`, `SalesChannel` и связанные сущности описывают весь цикл сделки — статусы, стадии, менеджеры, ожидаемые даты и Google Drive-метки.
- `policies`: `Policy` хранит номер, страхователя (`client`), тип, компанию, канал продаж, даты и автомобильные данные; гарантирует уникальность номера. Полис можно удалить только если у него нет оплаченных платежей (`actual_date`) и оплаченных финансовых записей; неоплаченные связанные сущности удаляются вместе с полисом. Поле `insured_client` сохранено только для обратной совместимости и считается legacy.
- `finances`: `Payment` ссылается на `Policy` и `Deal`, содержит сумму и даты, а `FinancialRecord` логирует доход/расход; удаление запрещено после оплаты. Ведомость (Statement) считается выплаченной по факту наличия `paid_at` (поле `status` не используется в бизнес-логике, оставлено для совместимости).
- `tasks`: `Task` отслеживает статусы (todo, in_progress, done и др.), приоритеты, ответственных и чек-листы, связанные со сделками.
- `documents`: `Document` хранит файлы и метаданные, а Open Notebook используется как отдельный источник для библиотечных блокнотов и ответов.
- `notes`, `chat`, `notifications`: коммуникация и логирование событий в контексте сделки (заметки, чаты, уведомления и отметки прочтения).
- `users`: роли (`Role`), права (`Permission`), связи (`UserRole`, `RolePermission`) и `AuditLog` фиксируют управление доступом.

### Модель данных
- `Client ⇄ Deal`: сделки привязаны к клиентам, а в `Policy`/`Note`/`Payment`/`ChatMessage` денормализуются данные клиента.
- `Deal` агрегирует `Quote`, `Task`, `Document`, `Policy`, `Payment`, `Note`, `ChatMessage`; статусы и задачи управляют жизненным циклом.
- `Policy` имеет индексы по номеру, сделке, страховой и клиентам, автоматически заполняет `client` по `deal`.
- Семантика клиентов: клиент в сделке (`Deal.client`) — контактное лицо сделки; клиент в полисе (`Policy.client`) — страхователь. Они могут не совпадать. Поле `Policy.insured_client` не используется в новой логике и оставлено как legacy для совместимости.
- `Payment` иногда включает `deal` как денормализованное поле, перед связью `financial_records` контролирует удаление.
- `Document` хранит файл, тип, чек-сумму и статус (draft/pending/completed/error); библиотечные материалы и ответы ведутся в Open Notebook.
- `Task`, `Notification`, `Note` обеспечивают поддержку напоминаний и коммуникаций; `AuditLog` хранит историю ролей и объектов.

## Основные блоки
### config/
- `settings.py` содержит базовую конфигурацию + разделение через `django-environ`/переменные окружения.
- `api_router.py` собирает роутеры из доменных приложений и регистрирует версии API.
- `urls.py` подключает `api_router`, админку, health-check и механизмы статики/медиа.
- `asgi.py`/`wsgi.py` используются для запуска uvicorn/gunicorn в контейнерах.
- `admin.py` подключает административные модели.

### apps/
- Каждое доменное приложение контролирует свою модельную часть, сериализаторы, permissions и ViewSet (например, `clients/views.py`, `deals/serializers.py`).
- `apps/common/` собирает перегруппированные миксины, фильтры, custom permissions и подписчики сигналов (включая менеджеры для уведомлений или связей с Google Drive).
- Маршруты (`routers.py`/`urls.py` внутри приложения) импортируются через `api_router`.

### tests/
- Используются DRF APIClient, фикстуры `tests/conftest.py` и примеры: `test_admin.py`, `test_permissions.py`, `test_signals.py`, `test_deal_history.py`, `test_encoding.py`.
- Цель — проверка API, сериализации, permissions и side effects (например, сигналы и интеграция с `clients`).

### Скрипты и утилиты
- `manage.py` управляет миграциями (`makemigrations`, `migrate`), shell, `loaddata`, `test`, `check --deploy`.
- Google Drive/OpenAI-интеграции подключаются через env. Для Google Drive поддерживается только OAuth-конфигурация через `GOOGLE_DRIVE_OAUTH_*` и folder id-переменные.
- `entrypoint.sh` (в Docker) применяет миграции и запускает сервер (gunicorn/uvicorn).

## Запуск и окружение
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env    # заполнить секреты и базу
python manage.py migrate
python manage.py runserver
```
- Для env: `DJANGO_SECRET_KEY`, `DEBUG`, `DJANGO_DB_*`, JWT-параметры, CORS, `GOOGLE_DRIVE_*` (OAuth client id/secret, refresh token или token file, folder ids), `OPENAI_*`.
- Для локального prod-like docker-контура используйте шаблон `backend/.env.example` и общий runbook: [../docs/local-prod-like-stack.md](../docs/local-prod-like-stack.md).
- Для распознавания полисов из Word: `.docx` поддерживается через Python-библиотеку, а для `.doc` нужен установленный LibreOffice/headless converter (`soffice`). В Docker-образ backend он устанавливается автоматически.
- Распознавание полисов через OpenRouter выполняется в два AI-прохода: первичное извлечение JSON и самопроверка результата по исходному тексту/страницам с формальными замечаниями CRM. Для PDF-полисов с плохим или табличным текстовым слоем включён vision-фолбэк. Управление: `POLICY_RECOGNITION_VISION_FALLBACK_ENABLED`, `POLICY_RECOGNITION_PDF_RENDER_DPI`, `POLICY_RECOGNITION_MAX_VISION_PAGES`.
- В промпт передаются названия и описания `InsuranceCompany`/`InsuranceType`; для точного выбора типов страхования поддерживайте заполненным `InsuranceType.description`. В Django admin для видов страхования есть фильтр пустых описаний и action `Заполнить стандартные AI-описания` для базовых категорий ОСАГО, КАСКО, ДГО/ДСАГО, GAP и авто-прочее.
- Перед релизом обязательно `python manage.py check --deploy`.
- `manage.py test` автоматически переключает backend на `config.test_settings`, чтобы локальные тесты не зависели от случайной Postgres-конфигурации.

## Авторизация (важно)
- Endpoints Open Notebook (knowledge) и `POST /api/v1/documents/recognize/` требуют JWT.
- `GET /api/v1/finances/summary/` требует JWT.

## Проверки и форматирование
- `isort .` (конфиг в `.isort.cfg`) и `black .` (через `pyproject.toml`) применяются к Python-коду; миграции исключены в black.
- `python manage.py test` или `pytest` (есть `pytest.ini`) запускает тесты через `config.test_settings`.
- По умолчанию test profile использует SQLite. Если нужен PostgreSQL-контур, задайте `CRM_TEST_USE_POSTGRES=true` и передайте `DJANGO_DB_*`.

## Runbook: миграция `policies.0015`
Цель миграции `0015_sync_client_from_insured_legacy`: выровнять исторические данные и перенести страхователя из legacy-поля `insured_client` в `client` там, где значения различаются.

Миграция запускается автоматически в deploy-пайплайне, так как backend стартует с `RUN_MIGRATIONS=true`.

### Pre-check (до deploy)
```sql
SELECT
  COUNT(*) AS total_policies,
  COUNT(*) FILTER (WHERE client_id IS NULL) AS client_null,
  COUNT(*) FILTER (WHERE insured_client_id IS NULL) AS insured_null,
  COUNT(*) FILTER (
    WHERE client_id IS NOT NULL
      AND insured_client_id IS NOT NULL
      AND client_id != insured_client_id
  ) AS conflicts
FROM policies_policy;
```

### Post-check (после deploy)
```sql
SELECT
  COUNT(*) FILTER (
    WHERE client_id IS NOT NULL
      AND insured_client_id IS NOT NULL
      AND client_id != insured_client_id
  ) AS conflicts_after
FROM policies_policy;
```

Ожидаемое значение: `conflicts_after = 0`.

### Дополнительно
- Убедиться, что backend-контейнер применил миграции (`python manage.py showmigrations policies`).
- Проверить выборочно 5-10 полисов в UI/API: страхователь отображается через `client`.
- Поле `insured_client` остаётся в схеме как legacy для обратной совместимости до отдельного этапа удаления.

## Docker и интеграция
- `backend/Dockerfile` создаёт образ на Python 3.12, копирует зависимости и код.
- В `docker-compose.yml` сервис монтирует `backend/.env`, `backend_static`, bind-монт локального `Media` и `runtime-secrets` для shared secret files вроде OAuth refresh token file.
- `entrypoint.sh` запускается в контейнере, применяя миграции и стартуя gunicorn с настройками `WORKERS` и `TIMEOUT`.

## Полезные команды
| Команда | Назначение |
| --- | --- |
| `python manage.py makemigrations && python manage.py migrate` | Обновление схемы БД |
| `python manage.py shell` | Доступ к ORM/утилитам |
| `python manage.py loaddata fixtures/<file>.json` | Импорт фикстур |
| `python manage.py drf_create_token` | Создание токена DRF, если команда доступна |
| `python manage.py check_external_services` | Smoke-проверка AI / Drive / Telegram / Open Notebook / mailcow |
| `python ../scripts/restore_local_backup.py` | Полный reset локальной Postgres и restore из свежего backup через локальный staging в `tmp/` |
| `python manage.py seed_demo_data --replace --count 30` | Пересоздать локальный demo-набор данных |

## Ресурсы
- `backend/tests/` — примеры API-тестов, проверок прав и регрессий по доменным приложениям.
- `AGENTS.md` указывает на кодировку, SSH, безопасность.
- `docker-compose.yml` связывает backend с Postgres (порт 5435) и nginx.
