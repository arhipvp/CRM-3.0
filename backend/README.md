# Backend (Django + DRF)

## Быстрый старт
```bash
cd backend
python -m venv .venv && .venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

## Структура
- `apps/clients` — клиенты и контакты.
- `apps/deals` — сделки, воронки, этапы.
- `apps/tasks` — задачи.
- `apps/documents` — документы и файлы.
- `apps/notifications` — уведомления.

REST API доступен по `http://localhost:8000/api/v1/`, health-check — `/health/`.
