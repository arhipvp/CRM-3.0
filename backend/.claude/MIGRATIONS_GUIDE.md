# Руководство по применению миграций

## Краткий старт

После переработки модели данных требуется выполнить следующие команды:

```bash
cd backend

# 1. Создать миграции для новых и изменённых моделей
python manage.py makemigrations

# 2. Применить миграции к базе данных
python manage.py migrate

# 3. (Опционально) Создать суперпользователя
python manage.py createsuperuser

# 4. (Опционально) Открыть Django админ-панель
python manage.py runserver
# Затем перейти на http://localhost:8000/admin
```

---

## Что было изменено

### Новые приложения
- ✅ `apps.common` - базовые классы для soft delete
- ✅ `apps.policies` - страховые полисы

### Переработанные приложения
- ✅ `apps.clients` - упрощена модель Client (удалён Contact)
- ✅ `apps.deals` - центральная сущность, добавлены seller и executor
- ✅ `apps.tasks` - переориентирована на Deal
- ✅ `apps.documents` - переориентирована на Deal
- ✅ `apps.notes` - переориентирована на Deal
- ✅ `apps.finances` - Payment, Income, Expense с soft delete
- ✅ `apps.notifications` - с soft delete

### Все модели
- ✅ Добавлено поле `deleted_at` для soft delete
- ✅ Наследуют `SoftDeleteModel`
- ✅ Используют `SoftDeleteManager` (автоматический фильтр по deleted_at)

---

## Миграции по приложениям

### 1. apps/common/migrations/
- `0001_initial.py` - создание базовых классов (если требуется отдельная модель)

### 2. apps/clients/migrations/
- `0001_initial.py` - будет пересоздана с новой схемой Client
  - Удаляется модель Contact
  - Client: оставляют name, phone, birth_date
  - Добавляется deleted_at

### 3. apps/deals/migrations/
- Обновление Deal:
  - Добавляются seller, executor
  - Добавляется description
  - Удаляется primary_contact FK
  - Добавляется deleted_at
  - on_delete для client меняется на PROTECT

### 4. apps/tasks/migrations/
- Обновление Task:
  - Удаляются client, contact FKs (остаётся только deal)
  - deal становится обязательным (null=False)
  - Добавляется deleted_at

### 5. apps/documents/migrations/
- Обновление Document:
  - Удаляется client, contact FKs (остаётся только deal)
  - deal становится обязательным
  - Обновляется upload_to path (documents/{deal_id}/{filename})
  - Добавляется deleted_at

### 6. apps/notes/migrations/
- Обновление Note:
  - Удаляется client FK (остаётся только deal)
  - deal становится обязательным
  - Добавляется deleted_at

### 7. apps/policies/migrations/ (НОВОЕ)
- `0001_initial.py` - создание модели Policy
  - Поля: number, insurance_company, insurance_type, deal, vin, start_date, end_date, amount, currency, status
  - FK на Deal с CASCADE

### 8. apps/finances/migrations/
- Обновление Payment, Income, Expense:
  - Добавляется deleted_at
  - Наследуют SoftDeleteModel

### 9. apps/notifications/migrations/
- Обновление Notification:
  - Добавляется deleted_at
  - Наследует SoftDeleteModel

---

## Возможные проблемы и решения

### Проблема: "No changes detected in app 'xxx'"
**Решение:** Django уже создал миграции для этого приложения. Это нормально.

### Проблема: "Column 'xx' does not exist"
**Решение:** Убедитесь, что вы применили все миграции:
```bash
python manage.py migrate
```

### Проблема: "FOREIGN KEY constraint failed"
**Решение:** Возможно, есть данные, которые не соответствуют новой схеме:
```bash
# Откатить все миграции (ВНИМАНИЕ: удалит все данные)
python manage.py migrate --zero

# Заново применить все миграции
python manage.py migrate
```

### Проблема: "IntegrityError: UNIQUE constraint failed"
**Решение:** При миграции Policy поле `number` должно быть уникальным.
Если у вас есть конфликты, удалите дублирующиеся данные перед миграцией.

---

## Проверка после миграции

```bash
# 1. Проверить статус миграций
python manage.py showmigrations

# 2. Проверить схему БД (SQLite)
sqlite3 db.sqlite3 ".schema"

# 3. Проверить, что приложения загружены
python manage.py shell
>>> from apps.common.models import SoftDeleteModel
>>> from apps.policies.models import Policy
>>> print("Всё работает!")
```

---

## Откат миграций

Если что-то пошло не так:

```bash
# Откатить последнюю миграцию конкретного приложения
python manage.py migrate apps 0001

# Откатить все миграции приложения
python manage.py migrate apps zero

# Откатить конкретную миграцию
python manage.py migrate apps 0005
```

---

## Обновление settings.py

Убедитесь, что в `config/settings.py` установлены новые приложения:

```python
INSTALLED_APPS = [
    # Django apps
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    # Third-party apps
    'rest_framework',
    'corsheaders',

    # Local apps
    'apps.common',      # ✅ НОВОЕ
    'apps.users',
    'apps.clients',
    'apps.deals',
    'apps.tasks',
    'apps.documents',
    'apps.notes',
    'apps.policies',    # ✅ НОВОЕ
    'apps.finances',
    'apps.notifications',
]
```

---

## Тестирование

```python
# Создать клиента
from apps.clients.models import Client
client = Client.objects.create(name="Иван Петров", phone="+7-999-123-45-67")

# Создать сделку
from apps.deals.models import Deal
deal = Deal.objects.create(title="Тест", client=client)

# Создать полис
from apps.policies.models import Policy
policy = Policy.objects.create(
    number="TEST-001",
    insurance_company="Ингосстрах",
    insurance_type="КАСКО",
    deal=deal
)

# Протестировать soft delete
policy.delete()
assert policy.is_deleted()  # True

# Проверить, что удалённые полисы не показываются
assert Policy.objects.count() == 0
assert Policy.objects.with_deleted().count() == 1

# Восстановить
policy.restore()
assert not policy.is_deleted()
```

---

## Готово! 🎉

После выполнения всех шагов ваша база данных будет полностью обновлена с новой моделью данных.

