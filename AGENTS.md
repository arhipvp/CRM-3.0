Внимательно следи за кодировкой при использовании русского языка!!!

Инструкция по правильной работе с консолью (чтобы не появлялись «кракозябры»):
- Используй PowerShell/Windows Terminal в UTF-8.
- Включай UTF-8 для Python: переменная окружения PYTHONUTF8=1 (или запуск `python -X utf8` при необходимости).
- Всегда явно указывай encoding="utf-8" при чтении/записи файлов с русским текстом.
- Убедись, что редактор сохраняет файлы в UTF-8 без BOM.
- Для Git: i18n.commitEncoding=utf-8 и i18n.logOutputEncoding=utf-8.

При работе с внешними библиотеками и фреймворками сначала используй Context7 для актуальной документации; если Context7 недоступен, явно сообщи об этом и опирайся на локальный код.

Я настроил подключение к моему серверу по ключу SSH root@173.249.7.183. Ключ C:\Users\Володенька/.ssh/id_ed25519. Ты можешь использовать это подключение для работы с сервером. Но сначала спроси у меня разрешение.

После написания кода проверяй через isort и black.

При необходимости вности изменения в документацию (README.md)
Переиспользуй стили и элементы во фронтенде, если видишь что есть несогласованность в стиле, то исправляй и объединяй в единые элементы. 

После любых правок обязательно проверяй изменённые файлы на отсутствие битой кодировки (кракозябр) в русском тексте. Если обнаружено — исправь кодировку перед запуском форматтеров/тестов.


Проверяй код через команды python.exe" -m isort backend && python.exe" -m black backend 
После любых правок во фронте запускать cd frontend && npm run format:check. Если падает — npm run format -- --write <файлы> и повторить проверку.

Отвечай на русском языке.

запускай PowerShell без -windowstyle hidden

ВАЖНО! При работе с миграциями используй средства Django.

# Repository Guidelines

## Project Structure & Module Organization
- `backend/` runs Django 5 + DRF; domain logic lives under `apps/*` (clients, deals, tasks, etc.), shared settings sit in `config/`, and generated media/static assets stay outside version control.
- `frontend/` hosts the React 19 + Vite + TypeScript client; source files are in `src/`, static files in `public/`, and `.env.example` documents required env vars.
- `frontend_example/` keeps throwaway UI experiments separate from the production bundle.
- Root-level `docker-compose.yml` wires Postgres (port 5435), backend, and Vite services; `.claude/` keeps agent artifacts, so leave it untouched.

## Build, Test, and Development Commands
- `cd backend && python -m venv .venv && .venv\Scripts\activate && pip install -r requirements.txt` installs backend dependencies.
- `cd backend && python manage.py runserver` serves the API at `http://localhost:8000/api/v1/`.
- `cd backend && python manage.py test` executes the Django test suite per app package.
- `cd frontend && npm install` installs Node dependencies; `npm run dev` boots the Vite dev server proxied through `VITE_API_URL`.
- `cd frontend && npm run build` emits the production bundle under `dist/`.
- `docker compose up --build` orchestrates the full stack with Postgres, honoring overrides from `backend/.env` (for example `DJANGO_DB_PORT=5435`).

## Coding Style & Naming Conventions
- Python follows PEP 8 with 4-space indents; modules are snake_case, classes PascalCase (for example `DealViewSet`). Keep serializers, permissions, and routers scoped inside each `apps/<domain>/` package.
- React and TypeScript code uses ESLint rules from `frontend/eslint.config.js`; components and hooks are PascalCase or `useCamelCase`, prefer function components, and keep module-relative imports tidy.
- Maintain type-annotated Django code and prefer DRF viewsets or routers plus `apps.common` utilities for shared behavior.

## Testing Guidelines
- Backend tests live beside app code (`apps/<domain>/tests/`). Name files `test_<feature>.py`, rely on DRF APIClient, and gate merges on `python manage.py test` with >=80% coverage locally.
- Frontend currently leans on linting plus manual Vite preview; when adding Vitest, colocate specs under `src/__tests__/` and snapshot complex flows. Include screenshots in PRs when UI changes.

## Commit & Pull Request Guidelines
- Follow Conventional Commits (`feat:`, `fix:`, `chore:`) as seen in `git log`; reference issues with `(#123)` when relevant.
- PRs must describe scope, testing (`python manage.py test`, `npm run lint`), data migration steps, and any UI changes. Request reviews from both backend and frontend owners for cross-stack work.

## Security & Configuration Tips
- Never commit secrets; copy `.env.example` for each service and set `DJANGO_SECRET_KEY`, `DATABASE_URL`, and `VITE_API_URL`. Use per-developer Postgres ports if multiple stacks run locally.
- Run `python manage.py check --deploy` before tagging releases and keep Docker images parameterized through compose env vars rather than hardcoding credentials.


