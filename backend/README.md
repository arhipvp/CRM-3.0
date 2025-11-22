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

## Excel import

1. Fill apps/clients/templates/client_import_template.xlsx (columns: Name, Phone, Birth Date, Notes). Birth Date accepts YYYY-MM-DD, DD.MM.YYYY, or DD/MM/YYYY.
2. Run python manage.py import_clients_from_excel path/to/file.xlsx [--sheet Sheet1] [--created-by USER] [--dry-run].
3. The command sets created_by when a user id/email/username is provided, skips blank rows, and leaves existing clients untouched.

## Multi-sheet business import

1. Use `scripts/templates/business_data_template_new.xlsx` to mirror the sheets/columns from `backup_2025-11-12_16-11.xlsx` (clients, deals, policies, payments, incomes, expenses, tasks).
2. Run `python scripts/import_business_data.py path/to/workbook.xlsx [--sheet deals] [--dry-run]`; without `--sheet` all sheets are processed, `--dry-run` validates only, and Django settings (including `DJANGO_SECRET_KEY`) are loaded from `backend/.env`.
3. Сервис заполняет `clients.Client`, `deals.Deal`, `policies.Policy`, `finances.Payment`, `finances.FinancialRecord`, `tasks.Task` (доходы/расходы тоже идут в `FinancialRecord`), а при встрече новых `InsuranceCompany`, `InsuranceType` или `SalesChannel` автоматически создаёт их записи.
