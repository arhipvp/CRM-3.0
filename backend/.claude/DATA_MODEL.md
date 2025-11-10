# Модель Данных CRM 3.0

## Обзор

Переработанная модель данных CRM 3.0 имеет **Deal (Сделка)** как центральную сущность, к которой замыкаются все остальные сущности. Все модели поддерживают **мягкое удаление (soft delete)** через `deleted_at` поле.

---

## Архитектура Soft Delete

### Базовый класс SoftDeleteModel

Все модели наследуются от `SoftDeleteModel` (`apps.common.models`), который предоставляет:

**Поля:**
- `id` - UUID первичный ключ
- `created_at` - DateTimeField (auto_now_add=True) - неизменяемое время создания
- `updated_at` - DateTimeField (auto_now=True) - время последнего изменения
- `deleted_at` - DateTimeField (nullable) - время удаления (NULL = активна)

**Manager (SoftDeleteManager):**
- По умолчанию возвращает только активные записи (deleted_at IS NULL)
- `.alive()` - только активные
- `.dead()` - только удалённые
- `.with_deleted()` - все записи (включая удалённые)

**Методы:**
- `.delete()` - мягкое удаление (устанавливает deleted_at)
- `.hard_delete()` - жёсткое удаление из БД
- `.restore()` - восстановление удалённой записи
- `.is_deleted()` - проверка, удалена ли запись

**QuerySet (SoftDeleteQuerySet):**
```python
# Примеры использования
Client.objects.alive()           # активные клиенты
Client.objects.dead()            # удалённые клиенты
Client.objects.with_deleted()    # все записи
Client.objects.filter(name="Иван")  # по умолчанию только активные
```

---

## Основные Сущности

### 1. CLIENT (Клиент)

**Назначение:** Персона (контрагент/контакт)

**Модель:** `apps.clients.Client`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `name` | CharField(255) | Да | ФИО клиента |
| `phone` | CharField(20) | Нет | Номер телефона |
| `birth_date` | DateField | Нет | Дата рождения |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Отношения:**
- One-to-Many с **Deal** (`deals`) - каскадное удаление запрещено (PROTECT)

**Пример:**
```python
# Создание клиента
client = Client.objects.create(
    name="Иван Петров",
    phone="+7-999-123-45-67",
    birth_date="1990-05-15"
)

# Удаление (мягкое)
client.delete()  # deleted_at будет установлен на текущее время

# Восстановление
client.restore()  # deleted_at станет NULL
```

---

### 2. DEAL (Сделка) - ЦЕНТРАЛЬНАЯ СУЩНОСТЬ

**Назначение:** Центральная сущность, замыкающая на себя все остальные сущности

**Модель:** `apps.deals.Deal`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `title` | CharField(255) | Да | Название сделки |
| `description` | TextField | Нет | Описание |
| `client` | ForeignKey | Да | Клиент (PROTECT) |
| `seller` | ForeignKey | Нет | Продавец (User) |
| `executor` | ForeignKey | Нет | Исполнитель (User) |
| `probability` | PositiveIntegerField | Да | Вероятность выигрыша 0-100% |
| `status` | CharField | Да | Статус: open, won, lost, on_hold |
| `stage_name` | CharField(120) | Нет | Название этапа |
| `expected_close` | DateField | Нет | Ожидаемая дата закрытия |
| `source` | CharField(100) | Нет | Источник |
| `loss_reason` | CharField(255) | Нет | Причина отказа |
| `channel` | CharField(100) | Нет | Канал продаж |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Статусы:**
- `open` - Открыта
- `won` - Выиграна
- `lost` - Потеряна
- `on_hold` - В ожидании

**Отношения:**
- Many-to-One с **Client** (обязательное, PROTECT)
- Many-to-One с **User** как `seller` (SET_NULL)
- Many-to-One с **User** как `executor` (SET_NULL)
- One-to-Many с **Task** (`tasks`) - каскадное удаление
- One-to-Many с **Document** (`documents`) - каскадное удаление
- One-to-Many с **Note** (`notes`) - каскадное удаление
- One-to-Many с **Payment** (`payments`) - каскадное удаление

**Пример:**
```python
from django.contrib.auth import get_user_model
from apps.clients.models import Client
from apps.deals.models import Deal

User = get_user_model()

# Создание сделки
client = Client.objects.get(name="Иван Петров")
seller = User.objects.get(username="ivanov")
executor = User.objects.get(username="petrov")

deal = Deal.objects.create(
    title="Продажа консультационного пакета",
    client=client,
    seller=seller,
    executor=executor,
    probability=75,
    status=Deal.DealStatus.OPEN,
    stage_name="Переговоры",
    expected_close="2025-12-31",
    source="Рекомендация",
    channel="Email"
)

# Удаление
deal.delete()  # soft delete
```

---

### 3. TASK (Задача)

**Назначение:** Задача, привязанная к сделке

**Модель:** `apps.tasks.Task`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `title` | CharField(255) | Да | Название задачи |
| `description` | TextField | Нет | Описание |
| `deal` | ForeignKey | Да | Сделка (CASCADE) |
| `assignee` | ForeignKey | Нет | Назначена (User, SET_NULL) |
| `created_by` | ForeignKey | Нет | Создана (User, SET_NULL) |
| `due_at` | DateTimeField | Нет | Срок выполнения |
| `remind_at` | DateTimeField | Нет | Время напоминания |
| `status` | CharField | Да | Статус: todo, in_progress, done, overdue, canceled |
| `priority` | CharField | Да | Приоритет: low, normal, high, urgent |
| `checklist` | JSONField | Да | Массив пунктов чек-листа |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Статусы:**
- `todo` - К выполнению
- `in_progress` - В процессе
- `done` - Завершена
- `overdue` - Просрочена
- `canceled` - Отменена

**Приоритеты:**
- `low` - Низкая
- `normal` - Обычная (по умолч.)
- `high` - Высокая
- `urgent` - Срочная

**Отношения:**
- Many-to-One с **Deal** (обязательное, CASCADE)
- Many-to-One с **User** как `assignee` (SET_NULL)
- Many-to-One с **User** как `created_by` (SET_NULL)

**Пример:**
```python
from apps.deals.models import Deal
from apps.tasks.models import Task

deal = Deal.objects.get(title="Продажа консультационного пакета")
assignee = User.objects.get(username="petrov")

task = Task.objects.create(
    title="Подготовить счёт",
    description="Создать счёт на сумму 50000 РУБ",
    deal=deal,
    assignee=assignee,
    due_at="2025-12-20 18:00:00",
    status=Task.TaskStatus.TODO,
    priority=Task.PriorityChoices.HIGH,
    checklist=["Заполнить детали", "Отправить клиенту"]
)

# Удаление задачи (cascade удалит и связанные данные)
task.delete()
```

---

### 4. DOCUMENT (Документ)

**Назначение:** Файл/документ, привязанный к сделке

**Модель:** `apps.documents.Document`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `title` | CharField(255) | Да | Название документа |
| `file` | FileField | Да | Файл (путь: documents/{deal_id}/{filename}) |
| `file_size` | PositiveIntegerField | Да | Размер в байтах (авто) |
| `mime_type` | CharField(120) | Нет | MIME тип |
| `deal` | ForeignKey | Да | Сделка (CASCADE) |
| `owner` | ForeignKey | Нет | Владелец (User, SET_NULL) |
| `doc_type` | CharField(120) | Нет | Тип документа |
| `status` | CharField(50) | Да | Статус (по умолч. 'draft') |
| `checksum` | CharField(128) | Нет | Контрольная сумма |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Отношения:**
- Many-to-One с **Deal** (обязательное, CASCADE)
- Many-to-One с **User** как `owner` (SET_NULL)

**Пример:**
```python
from apps.documents.models import Document

deal = Deal.objects.first()

doc = Document.objects.create(
    title="Договор оказания услуг",
    file="путь_к_файлу.pdf",
    deal=deal,
    owner=request.user,
    doc_type="Договор",
    status="signed"
)
```

---

### 5. NOTE (Заметка)

**Назначение:** Комментарий/заметка к сделке

**Модель:** `apps.notes.Note`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `deal` | ForeignKey | Да | Сделка (CASCADE) |
| `body` | TextField | Да | Текст заметки |
| `author_name` | CharField(120) | Нет | Имя автора |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Отношения:**
- Many-to-One с **Deal** (обязательное, CASCADE)

**Пример:**
```python
from apps.notes.models import Note

deal = Deal.objects.first()

note = Note.objects.create(
    deal=deal,
    body="Клиент просил скидку 15%. Нужно согласовать с руководством.",
    author_name="Иван Иванов"
)
```

---

### 6. PAYMENT (Платёж)

**Назначение:** Платёж в рамках сделки

**Модель:** `apps.finances.Payment`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `deal` | ForeignKey | Да | Сделка (CASCADE) |
| `amount` | DecimalField(12,2) | Да | Сумма платежа (в рублях) |
| `description` | CharField(255) | Нет | Описание |
| `scheduled_date` | DateField | Нет | Запланированная дата |
| `actual_date` | DateField | Нет | Фактическая дата |
| `status` | CharField(20) | Да | Статус: planned, partial, paid |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Статусы:**
- `planned` - Запланирован
- `partial` - Частичный
- `paid` - Оплачен

**Отношения:**
- Many-to-One с **Deal** (обязательное, CASCADE)
- One-to-Many с **Income** (`incomes`) - CASCADE
- One-to-Many с **Expense** (`expenses`) - CASCADE

**Пример:**
```python
from apps.finances.models import Payment

deal = Deal.objects.first()

payment = Payment.objects.create(
    deal=deal,
    amount=25000,
    currency="RUB",
    description="Авансовый платёж",
    scheduled_date="2025-12-15",
    status=Payment.PaymentStatus.PLANNED
)
```

---

### 7. INCOME (Доход)

**Назначение:** Полученный доход по платежу

**Модель:** `apps.finances.Income`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `payment` | ForeignKey | Да | Платёж (CASCADE) |
| `amount` | DecimalField(12,2) | Да | Сумма дохода (в рублях) |
| `received_at` | DateField | Нет | Дата получения |
| `source` | CharField(120) | Нет | Источник |
| `note` | TextField | Нет | Примечание |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Отношения:**
- Many-to-One с **Payment** (обязательное, CASCADE)

---

### 8. EXPENSE (Расход)

**Назначение:** Расход в рамках платежа

**Модель:** `apps.finances.Expense`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `payment` | ForeignKey | Да | Платёж (CASCADE) |
| `amount` | DecimalField(12,2) | Да | Сумма расхода (в рублях) |
| `expense_type` | CharField(120) | Да | Тип расхода |
| `expense_date` | DateField | Нет | Дата расхода |
| `note` | TextField | Нет | Примечание |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Отношения:**
- Many-to-One с **Payment** (обязательное, CASCADE)

---

### 9. POLICY (Полис)

**Назначение:** Страховой полис, привязанный к сделке

**Модель:** `apps.policies.Policy`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `number` | CharField(50) | Да | Номер полиса (уникален) |
| `insurance_company` | CharField(255) | Да | Наименование страховой компании |
| `insurance_type` | CharField(120) | Да | Вид страхования (КАСКО, ОСАГО и т.д.) |
| `deal` | ForeignKey | Да | Сделка (CASCADE) |
| `vin` | CharField(17) | Нет | VIN автомобиля (для авто полисов) |
| `start_date` | DateField | Нет | Дата начала действия |
| `end_date` | DateField | Нет | Дата окончания действия |
| `amount` | DecimalField(12,2) | Да | Сумма страховки в рублях (по умолч. 0) |
| `status` | CharField(50) | Да | Статус (active, expired, canceled и т.д.) |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Отношения:**
- Many-to-One с **Deal** (обязательное, CASCADE)

**Примечание:** Примечания о полисе сохраняются в таблице Note (отдельная таблица для всех комментариев)

**Пример:**
```python
from apps.policies.models import Policy

deal = Deal.objects.first()

policy = Policy.objects.create(
    number="КАСКО-2025-001",
    insurance_company="Ингосстрах",
    insurance_type="КАСКО",
    deal=deal,
    vin="WBA1234567890ABCD",
    start_date="2025-01-01",
    end_date="2025-12-31",
    amount=50000,
    status="active"
)
```

---

### 10. NOTIFICATION (Уведомление)

**Назначение:** Уведомление для пользователя

**Модель:** `apps.notifications.Notification`

**Поля:**

| Поле | Тип | Обязательное | Описание |
|------|-----|-------------|---------|
| `id` | UUID | Да | Первичный ключ |
| `user` | ForeignKey | Да | Пользователь (CASCADE) |
| `type` | CharField(120) | Да | Тип уведомления |
| `payload` | JSONField | Да | Данные уведомления (по умолч. {}) |
| `is_read` | BooleanField | Да | Прочитано (по умолч. False) |
| `read_at` | DateTimeField | Нет | Время прочтения |
| `created_at` | DateTimeField | Да | Дата создания (авто) |
| `updated_at` | DateTimeField | Да | Дата обновления (авто) |
| `deleted_at` | DateTimeField | Нет | Дата удаления (NULL=активна) |

**Отношения:**
- Many-to-One с **User** (обязательное, CASCADE)

**Методы:**
- `mark_as_read()` - отметить как прочитано

---

## Диаграмма Связей

```
CLIENT (Простая сущность)
├── name
├── phone
└── birth_date

    ↓ (PROTECT - нельзя удалить клиента со сделками)

DEAL (ЦЕНТРАЛЬНАЯ СУЩНОСТЬ) ⭐
├── title
├── description
├── seller (User)
├── executor (User)
├── amount
├── probability
├── status
├── expected_close
├── source
├── channel
│
├──→ TASK (CASCADE)
│    ├── title
│    ├── assignee (User)
│    ├── status
│    └── priority
│
├──→ DOCUMENT (CASCADE)
│    ├── title
│    ├── file
│    ├── doc_type
│    └── owner (User)
│
├──→ NOTE (CASCADE)
│    ├── body
│    └── author_name
│
├──→ POLICY (CASCADE) ⭐ NEW
│    ├── number (уникален)
│    ├── insurance_company
│    ├── insurance_type
│    ├── vin
│    ├── start_date
│    ├── end_date
│    └── amount
│
└──→ PAYMENT (CASCADE)
     ├── amount
     ├── status
     │
     ├──→ INCOME (CASCADE)
     │    ├── amount
     │    └── received_at
     │
     └──→ EXPENSE (CASCADE)
          ├── amount
          └── expense_type

USER (Django built-in)
├── sold_deals (Deal.seller)
└── executed_deals (Deal.executor)
```

---

## Примеры Использования

### Получение всех активных сделок клиента

```python
from apps.clients.models import Client
from apps.deals.models import Deal

client = Client.objects.get(name="Иван Петров")
active_deals = client.deals.alive()  # автоматически отфильтровано по deleted_at
```

### Получение всех полисов для сделки

```python
from apps.policies.models import Policy

deal = Deal.objects.get(title="Продажа консультационного пакета")
policies = deal.policies.alive()  # только активные полисы
```

### Получение всех задач для сделки

```python
deal = Deal.objects.get(title="Продажа консультационного пакета")
tasks = deal.tasks.alive()  # только активные задачи
```

### Создание сделки с полисом

```python
from apps.clients.models import Client
from apps.deals.models import Deal
from apps.policies.models import Policy

# Создаём сделку
client = Client.objects.get(name="Иван Петров")
deal = Deal.objects.create(
    title="Страховка автомобиля",
    client=client,
    seller=User.objects.get(username="seller"),
    status=Deal.DealStatus.OPEN
)

# Привязываем полис к сделке
policy = Policy.objects.create(
    number="КАСКО-2025-001",
    insurance_company="Ингосстрах",
    insurance_type="КАСКО",
    deal=deal,
    vin="WBA1234567890ABCD",
    start_date="2025-01-01",
    end_date="2025-12-31",
    amount=50000
)
```

### Удаление сделки с каскадным удалением

```python
deal = Deal.objects.get(pk="...")
deal.delete()  # мягкое удаление

# Все связанные Task, Document, Note, Policy, Payment также получат deleted_at
# Но CLIENT остаётся на месте (PROTECT)
```

### Восстановление удалённой сделки

```python
# Включаем удалённые в выборку
deal = Deal.objects.with_deleted().get(pk="...")
deal.restore()  # deleted_at станет NULL

# Автоматически восстанавливаются ли связанные? НЕТ
# Нужно восстанавливать вручную
for task in deal.tasks.dead():
    task.restore()
for policy in deal.policies.dead():
    policy.restore()
```

### Жёсткое удаление (физическое удаление из БД)

```python
deal = Deal.objects.get(pk="...")
deal.hard_delete()  # Полное удаление из БД
```

---

## Установленные приложения

Django проект имеет следующие приложения с моделями:

1. **apps.common** - Базовые классы (SoftDeleteModel, SoftDeleteManager, SoftDeleteQuerySet)
2. **apps.clients** - Клиенты (Client)
3. **apps.deals** - Сделки (Deal) ⭐ ЦЕНТРАЛЬНАЯ
4. **apps.tasks** - Задачи (Task)
5. **apps.documents** - Документы (Document)
6. **apps.notes** - Заметки (Note)
7. **apps.policies** - Полисы (Policy) ⭐ NEW
8. **apps.finances** - Финансы (Payment, Income, Expense)
9. **apps.notifications** - Уведомления (Notification)
10. **apps.users** - Пользователи (использует Django built-in User)

---

## Миграции

После внесения изменений требуется создать и применить миграции:

```bash
# Создание миграций для всех приложений
python manage.py makemigrations

# Применение миграций
python manage.py migrate
```

**Основные изменения:**
1. Добавлен новый app `apps.common` с базовым классом `SoftDeleteModel`
2. Добавлен новый app `apps.policies` с моделью Policy
3. Все модели переведены на наследование от `SoftDeleteModel`
4. Добавлено поле `deleted_at` во все таблицы
5. Client упрощён: осталось только name, phone, birth_date
6. Contact удалён
7. Deal стала центральной сущностью
8. Все связи переориентированы на Deal
9. Добавлена поддержка полисов (Policy)

---

## Заключение

Новая модель данных имеет следующие преимущества:

✅ **Deal как центр** - все данные логически связаны со сделкой
✅ **Soft Delete** - история данных сохраняется (deleted_at поле)
✅ **Простота Client** - клиент это просто ФИО, телефон, дата рождения
✅ **Полисы интегрированы** - Policy замыкаются на Deal, поддержка КАСКО, ОСАГО и т.д.
✅ **Каскадные удаления** - удаление сделки удаляет все зависимые данные (Task, Document, Note, Policy, Payment)
✅ **Защита от удаления** - клиент нельзя удалить через CASCADE (PROTECT)
✅ **Гибкость** - seller и executor могут быть не заполнены
✅ **Масштабируемость** - easy to add new entities tied to Deal

### Структура после переработки:

| Сущность | Статус | Назначение |
|----------|--------|-----------|
| Client | ✅ Переработана | ФИО, телефон, дата рождения |
| Deal | ✅ Переработана | Центральная сущность, объединяет всё |
| Task | ✅ Переработана | Задачи для сделки |
| Document | ✅ Переработана | Файлы и документы |
| Note | ✅ Переработана | Комментарии и заметки |
| Policy | ✅ НОВАЯ | Страховые полисы |
| Payment | ✅ Переработана | Платежи и финансы |
| Income | ✅ Переработана | Полученные доходы |
| Expense | ✅ Переработана | Расходы |
| Notification | ✅ Переработана | Уведомления для пользователей |
| Contact | ❌ Удалена | Больше не нужна (данные в Client) |

Все модели поддерживают **мягкое удаление** через поле `deleted_at`.

