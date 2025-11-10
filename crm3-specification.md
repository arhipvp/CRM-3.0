# Спецификация CRM 3.0 (Django + React)

## 1. Цель
Перезапустить CRM как компактное single-tenant приложение на стеке Django + React. Ключевой объект — клиент, вокруг которого строятся контакты, сделки, задачи, документы и взаимодействия.

## 2. Архитектурные принципы
1. **Monorepo**: `backend/` (Django 5 + DRF) и `frontend/` (React 18 + Vite + TypeScript).
2. **API-first**: фронтенд общается только через REST `/api/v1`.
3. **База данных**: PostgreSQL 16, схема `crm`, миграции Django.
4. **Авторизация**: JWT (access + refresh). Access хранится в памяти приложения, refresh — httpOnly cookie.
5. **Синхронность**: все операции выполняются в Django-приложении; фоновые очереди не используются в MVP.
6. **Хранение файлов**: локальная папка `storage/` в рабочей директории. Django отдаёт временные ссылки с проверкой прав.
7. **Конфигурация**: `.env` + `django-environ`, управление секретами и путями к хранилищу файлов.

## 3. Доменная модель
Все сущности имеют стандартные поля аудита (`created_at`, `updated_at`, `created_by_id`, `updated_by_id`) и soft-delete (`is_deleted`, `deleted_at`). Доп. данные — в JSON `extra`.

### 3.1 Пользователи
| Сущность | Поля |
| --- | --- |
| `User` | `id`, `email`, `password`, `full_name`, `role` (`admin`, `seller`, `executor`), `position`, `phone`, `avatar_path`, `is_active`, `last_login`, `settings JSON` |

### 3.2 Клиенты и CRM ядро
| Сущность | Поля |
| --- | --- |
| `Client` | `id`, `type` (`company/person`), `name`, `legal_name?`, `tax_id?`, `industry`, `source`, `website`, `addresses JSON`, `phones[]`, `emails[]`, `messengers JSON`, `owner_id`, `status`, `rating`, `tags[]`, `extra` |
| `Contact` | `id`, `client_id`, `full_name`, `position`, `phones[]`, `emails[]`, `messengers JSON`, `owner_id`, `birthday`, `preferred_channel`, `tags[]`, `notes`, `extra` |
| `Pipeline` | `id`, `name`, `code`, `is_default`, `order_index` |
| `DealStage` | `id`, `pipeline_id`, `name`, `code`, `order_index`, `probability_hint`, `color` |
| `Deal` | `id`, `title`, `pipeline_id`, `stage_id`, `client_id`, `primary_contact_id`, `owner_id`, `amount`, `currency`, `probability`, `status` (`open/won/lost/on_hold`), `expected_close`, `source`, `loss_reason`, `channel`, `extra` |
| `DealParticipant` | `id`, `deal_id`, `contact_id`, `role`, `is_primary` |
| `Product` | `id`, `sku`, `name`, `description`, `unit`, `price`, `vat_rate`, `is_active` |
| `DealProduct` | `id`, `deal_id`, `product_id`, `qty`, `price`, `discount`, `vat_rate`, `line_total` |

### 3.3 Взаимодействия
| Сущность | Поля |
| --- | --- |
| `Task` | `id`, `title`, `description`, `deal_id?`, `client_id?`, `contact_id?`, `assignee_id`, `created_by_id`, `due_at`, `remind_at`, `status` (`todo/in_progress/done/overdue/canceled`), `priority`, `checklist JSON`, `extra` |
| `Comment` | `id`, `target_type`, `target_id`, `author_id`, `body`, `attachments[]`, `is_internal` |
| `Activity` | `id`, `actor_id`, `verb`, `target_type`, `target_id`, `context JSON`, `created_at` |
| `Note` | `id`, `target_type`, `target_id`, `author_id`, `body`, `pinned`, `color`, `created_at`, `updated_at` |
| `Document` | `id`, `title`, `file_path`, `file_size`, `mime_type`, `deal_id?`, `client_id?`, `contact_id?`, `owner_id`, `doc_type`, `status`, `checksum`, `extra` |
| `Template` | `id`, `name`, `category`, `body`, `placeholders JSON`, `is_active` |
| `Notification` | `id`, `user_id`, `type`, `payload JSON`, `is_read`, `read_at` |

### 3.4 Справочники
| Таблица | Поля |
| --- | --- |
| `Tag` | `id`, `name`, `color`, `entity_type` |
| `Source` | `id`, `name`, `channel`, `is_active` |
| `LossReason` | `id`, `name`, `description`, `is_active` |

## 4. Роли и права
| Роль | Назначение | Права |
| --- | --- | --- |
| `admin` | Системный владелец | Полный доступ, управление пользователями, справочниками, файлами. |
| `seller` (Продавец) | Ведёт клиентов и сделки | Создание/редактирование клиентов, контактов, сделок, документов; назначение задач исполнителям; просмотр всех данных. |
| `executor` (Исполнитель) | Работает по задачам | Видит назначенные на себя сделки/клиентов/контакты/документы; может обновлять статус задач, оставлять комментарии, прикладывать файлы. |

Реализация: DRF permissions, декораторы `role_required`, объектные проверки по `owner_id` и назначению.

## 5. REST API
Ответы — JSON, пагинация limit/offset.

### 5.1 Auth
`POST /auth/token/`, `POST /auth/token/refresh/`, `POST /auth/logout/`, `POST /auth/password/reset/`, `POST /auth/password/reset/confirm/`.

### 5.2 Пользователи
`GET /users/`, `POST /users/`, `PATCH /users/{id}/`, `PATCH /users/{id}/status/`, `GET /users/me/`, `PATCH /users/me/`.

### 5.3 Клиенты и справочники
- `GET /clients/` с фильтрами по статусу, тегу, источнику, ответственному.
- `POST /clients/`, `PATCH /clients/{id}/`, `DELETE` (soft).
- `GET /clients/{id}/contacts/`, `POST /clients/{id}/contacts/`.
- `GET /references/tags/`, `POST /references/tags/`.
- `GET /references/pipelines/`, `POST`, `PATCH`, `DELETE`.
- `GET /references/pipelines/{id}/stages/`.
- `GET /references/products/`, `POST`, `PATCH`, `DELETE`.
- `GET /references/sources/`, `GET /references/loss-reasons/`.

### 5.4 Контакты и сделки
- `GET /contacts/`, `POST /contacts/`, `PATCH /contacts/{id}/`.
- `GET /deals/` (фильтры: `stage`, `pipeline`, `owner`, `client`, `q`, суммы, даты).
- `POST /deals/`, `GET /deals/{id}/`, `PATCH /deals/{id}/`.
- `POST /deals/{id}/move/` (смена этапа).
- `POST /deals/{id}/participants/`, `DELETE /deals/{id}/participants/{pid}/`.
- `GET /deals/{id}/products/`, `POST /deals/{id}/products/`.

### 5.5 Задачи и взаимодействия
- `GET /tasks/`, `POST /tasks/`, `PATCH /tasks/{id}/`, `PATCH /tasks/{id}/status/`, `DELETE /tasks/{id}/`.
- `GET /notes/`, `POST /notes/`, `PATCH /notes/{id}/pin/`.
- `GET /comments/`, `POST /comments/`.
- `GET /activities/` (фильтр по сущности/дате/пользователю).

### 5.6 Документы и шаблоны
- `POST /documents/upload/` (Multipart → файл в `storage/`).
- `GET /documents/`, `GET /documents/{id}/download/`, `PATCH /documents/{id}/`.
- `GET /templates/`, `POST /templates/`, `PATCH /templates/{id}/`.

### 5.7 Уведомления
`GET /notifications/`, `PATCH /notifications/{id}/read/`, `POST /notifications/read-all/`.

## 6. Фронтенд
React SPA разбивается на модули:
1. **Auth** — вход, восстановление пароля, приглашение пользователя.
2. **Dashboard** — сводка по воронке (канбан, метрики выручки, список задач, уведомления).
3. **Клиенты** — таблица со статусами, тегами и источниками; карточка клиента (общая инфа, контакты, сделки, документы, заметки, файлы).
4. **Контакты** — таблица + kanban по статусам лида; карточка с таймлайном, заметками, задачами, файлами.
5. **Сделки** — канбан/таблицы; карточка сделки: детали, участники, товары, документы, чат, таймлайн, задачи, заметки.
6. **Продукты и прайс** — каталог товаров/услуг, управление ценами, налогами, остатками (по необходимости).
7. **Задачи** — представления «Список», «Календарь», «Мой день», фильтры по исполнителю и типу; чеклисты, быстрые комментарии.
8. **Документы** — библиотека файлов, предпросмотр PDF/изображений, связь с клиентами/сделками, генерация по шаблонам.
9. **Шаблоны документов** — редактор placeholders, предпросмотр, история версий.
10. **Уведомления и активность** — центр уведомлений + отдельная страница ленты событий с поиском.
11. **Отчёты** — базовые отчёты «Выручка по этапам», «Число клиентов по источникам», «Нагрузка исполнителей».
12. **Настройки** — пользователи, роли, pipelines, источники, теги, причины проигрыша, параметры системы (название, логотип), интеграции email/SMS (заглушки).

Состояние: React Query + Zustand, формы на React Hook Form, UI — MUI (light/dark). Валидация и уведомления через react-hook-form/resolvers и Snackbar-систему.

## 7. Нефункциональные требования
- **Производительность**: p95 < 200 мс при 150 RPS; тяжёлые операции (генерация документа) ограничены 5 с.
- **Надёжность**: ежедневные бэкапы БД и `storage/`; контроль целостности файлов по checksum.
- **Безопасность**: HTTPS, CSP, парольная политика (≥12 символов), аудит действий, журнал входов, возможность включить 2FA позже.
- **Наблюдаемость**: Sentry, структурированные JSON-логи, Prometheus-метрики через `django-prometheus`.
- **Тесты**: pytest + factory_boy, API-снимки, e2e (Playwright) для сценариев «Создание клиента», «Проведение сделки», «Загрузка документа».

## 8. Миграция данных
1. **Инвентаризация**: выгрузить из CRM_2.0 клиентов, контакты, сделки, задачи, документы, продукты, пользователей.
2. **Маппинг**: сопоставить поля; устаревшие данные складывать в `extra` или таблицы `legacy_*`.
3. **Импорт**: management-команды `import_clients`, `import_contacts`, `import_deals`, `import_tasks`, `import_documents`.
4. **Валидация**: запуск smoke-тестов API, сверка количеств и сумм; формирование отчёта об отклонениях.

## 9. Roadmap
1. **MVP**: пользователи, клиенты, контакты, сделки (канбан), задачи, документы, уведомления.
2. **Этап 2**: отчёты, шаблоны документов, каталог продуктов, расширенные права (команды), интеграция почты.
3. **Этап 3**: автоматизации (триггеры), вебхуки, интеграции телефонии и мессенджеров.

Документ — база для планирования бэклога и постановки задач.
