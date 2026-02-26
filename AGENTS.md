# AGENTS.md — CRM-3.0

Ты работаешь в монорепозитории CRM 3.0: Django 5 + DRF (`backend/`) и React 19 + Vite + TypeScript (`frontend/`), плюс скрипты, docker-compose, systemd, Telegram-бот и mailcow. :contentReference[oaicite:1]{index=1}

## 0) Самое важное: кодировка (иначе будет “кракозябры”)
- Всегда работай в UTF-8.
- Для Python на Windows используй `PYTHONUTF8=1` или запуск `python -X utf8` при необходимости.
- При чтении/записи файлов с русским текстом всегда указывай `encoding="utf-8"`.
- Не сохраняй файлы в “UTF-8 with BOM”, если это ломает линтеры/сравнение.
- После правок проверь, что русский текст не “побился” ДО запуска форматтеров/тестов. :contentReference[oaicite:2]{index=2}

## 1) Режим работы: “логические субагенты”
Если задача не тривиальная, работай как supervisor и дели на роли:

### Architect
- Быстро находит нужные файлы/модули, строит план.
- Ничего не рефакторит “просто так”.

### Backend Engineer
- Меняет только `backend/` (Django/DRF), уважает миграции и существующий стиль.

### Frontend Engineer
- Меняет только `frontend/` (React/Vite/TS), переиспользует существующие компоненты/хуки.

### Tester
- Добавляет/чинит тесты (backend приоритет).
- Обязательно прогоняет команды проверок для затронутой части.

### Reviewer/Security
- Ищет риски: секреты, хардкод токенов, небезопасные эндпоинты, сломанные миграции/контракты API.

**Workflow (обязательный):**
1) Architect: план + список файлов.
2) Engineer: минимальные правки под план.
3) Tester: тесты/проверки.
4) Reviewer: чеклист рисков.
5) Короткий итог: что изменено, как проверить.

## 2) Структура проекта (куда смотреть)
- `backend/` — Django 5 + DRF, доменные приложения в `backend/apps/*` (clients/deals/tasks/notes/finances/documents/chat/policies/notifications/users/common). :contentReference[oaicite:3]{index=3}
- `frontend/` — React 19 + Vite + TS, код в `frontend/src/`, общие компоненты в `frontend/src/components/common/*`. :contentReference[oaicite:4]{index=4}
- `scripts/` — импорт/трансформации/бэкапы, включая Google Drive backup. :contentReference[oaicite:5]{index=5}
- `systemd/` — юниты для задач типа бэкапа. :contentReference[oaicite:6]{index=6}
- `mailcow/` — подпапка/сабмодуль (не трогать без явной причины). :contentReference[oaicite:7]{index=7}

## 3) Правила изменений (чтобы не устроить пожар)
- Не меняй миграции вручную. Только стандартные инструменты Django.
- Не “косметически” рефактори: только то, что нужно для задачи.
- Во фронте переиспользуй существующие элементы/стили; если видишь дублирование, объединяй аккуратно и локально (без переписывания всего UI). :contentReference[oaicite:8]{index=8}
- Никогда не коммить секреты. Никаких реальных токенов, ключей, паролей в репо. :contentReference[oaicite:9]{index=9}

## 4) Команды разработки и проверки

### Backend (Windows-friendly)
- Установка/запуск (локально):
  - `cd backend`
  - `python -m venv .venv`
  - `.venv\Scripts\activate`
  - `pip install -r requirements.txt`
  - `cp .env.example .env`
  - `python manage.py migrate`
  - `python manage.py runserver`
- Тесты: `python manage.py test`
- Форматирование/импорты (обязательно после правок):
  - `python -m isort backend`
  - `python -m black backend` :contentReference[oaicite:10]{index=10}

### Frontend
- `cd frontend`
- `npm install`
- `cp .env.example .env`
- dev: `npm run dev`
- build: `npm run build`
- lint/формат:
  - сначала `npm run format:check`
  - если падает: `npm run format -- --write <файлы>` и снова `npm run format:check` :contentReference[oaicite:11]{index=11}

### Docker Compose
- `docker compose up --build` (Postgres обычно на порту 5435) :contentReference[oaicite:12]{index=12}

## 5) Интеграции и сервисы (не ломай контракт)
- API базово `/api/v1`, есть health endpoint и OpenAPI docs. :contentReference[oaicite:13]{index=13}
- Telegram-бот: запускается отдельным процессом/сервисом (`run_telegram_bot`), в prod выделен `telegram_bot`. :contentReference[oaicite:14]{index=14}
- Google Drive backup: скрипты используют env-переменные Drive/DB; не хардкодить пути/токены. :contentReference[oaicite:15]{index=15}
- Mailcow: используется через внешнюю сеть/прокси; не трогать, если задача не про почту. :contentReference[oaicite:16]{index=16}

## 6) SSH/сервер
В репо есть упоминание подключения к серверу по SSH. Никогда не подключайся и не выполняй команды на сервере без явного разрешения пользователя в текущем чате. :contentReference[oaicite:17]{index=17}

## 7) Формат ответа
- Пиши по-русски.
- Для изменений всегда давай:
  1) что и где поменял (файлы),
  2) как проверить (команды),
  3) риски/что могло сломаться.