# Backend (Django + DRF)

## Quick start

```
cd backend
python -m venv .venv && .venv\Scripts\activate  # Windows
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py runserver
```

## Структура

- `apps/clients` - клиенты и контакты
- `apps/deals` - сделки, воронки и этапы
- `apps/tasks` - задачи
- `apps/documents` - документы и файлы
- `apps/notifications` - уведомления
- `config` - общие настройки Django

REST API доступен по `http://localhost:8000/api/v1/`, health-check - `/health/`.

## Excel client import

1. Заполните `apps/clients/templates/client_import_template.xlsx` (столбцы: Name, Phone, Birth Date, Notes).
2. `python manage.py import_clients_from_excel path/to/file.xlsx [--sheet Sheet1] [--created-by USER] [--dry-run]`.
3. Команда пропускает пустые строки, передаёт `created_by`, когда задан пользователь, и не трогает существующих клиентов.

## Multi-sheet business import

1. Используйте `scripts/templates/business_data_template_new.xlsx` с листами `clients`, `deals`, `policies`, `payments`, `incomes`, `expenses`, `tasks`.
2. `python scripts/import_business_data.py path/to/workbook.xlsx [--sheet deals] [--dry-run]`; без `--sheet` обрабатываются все листы, `--dry-run` валидирует, настройки берутся из `backend/.env`.
3. Скрипт создаёт `clients.Client`, `deals.Deal`, `policies.Policy`, `finances.Payment`, `finances.FinancialRecord`, `tasks.Task` и автоматически создаёт связанные `InsuranceCompany`, `InsuranceType`, `SalesChannel`, если их нет.

Дополнительные детали по полям и переходу из старой базы находятся в `docs/DATA_TRANSFER.md`.
