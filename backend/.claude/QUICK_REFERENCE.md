# Быстрая справка по моделям данных

## Основные сущности

### CLIENT (Клиент)
```python
from apps.clients.models import Client

# Создание
client = Client.objects.create(
    name="Иван Петров",
    phone="+7-999-123-45-67",
    birth_date="1990-05-15"
)

# Чтение
all_clients = Client.objects.alive()  # только активные
client = Client.objects.get(name="Иван Петров")

# Удаление (soft)
client.delete()  # deleted_at установится

# Восстановление
client.restore()  # deleted_at = NULL

# Получить удалённого
deleted = Client.objects.with_deleted().get(name="...")
```

### DEAL (Сделка) - ЦЕНТРАЛЬНАЯ
```python
from apps.deals.models import Deal
from django.contrib.auth import get_user_model

User = get_user_model()

# Создание
seller = User.objects.get(username="seller")
executor = User.objects.get(username="executor")

deal = Deal.objects.create(
    title="Страховка авто",
    description="КАСКО полис на BMW",
    client=client,
    seller=seller,
    executor=executor,
    probability=75,
    status=Deal.DealStatus.OPEN,
    stage_name="Согласование",
    expected_close="2025-12-31"
)

# Получить все сделки клиента
deals = client.deals.alive()

# Изменение статуса
deal.status = Deal.DealStatus.WON
deal.save()

# Удаление (каскадное soft delete всех связанных)
deal.delete()
```

### POLICY (Полис) - НОВОЕ
```python
from apps.policies.models import Policy

# Создание
policy = Policy.objects.create(
    number="КАСКО-2025-001",        # уникален!
    insurance_company="Ингосстрах",
    insurance_type="КАСКО",
    deal=deal,
    vin="WBA1234567890ABCD",
    start_date="2025-01-01",
    end_date="2025-12-31",
    amount=50000,
    status="active"
)

# Получить все полисы сделки
policies = deal.policies.alive()

# Получить по номеру
policy = Policy.objects.get(number="КАСКО-2025-001")

# Удаление
policy.delete()
```

### TASK (Задача)
```python
from apps.tasks.models import Task

# Создание
task = Task.objects.create(
    title="Подготовить счёт",
    description="На сумму 50000 РУБ",
    deal=deal,
    assignee=executor,
    created_by=seller,
    priority=Task.PriorityChoices.HIGH,
    status=Task.TaskStatus.TODO,
    due_at="2025-12-20 18:00",
    checklist=["Заполнить данные", "Отправить клиенту"]
)

# Получить все задачи сделки
tasks = deal.tasks.alive()

# Изменить статус
task.status = Task.TaskStatus.IN_PROGRESS
task.save()

# Получить мои назначенные задачи
my_tasks = Task.objects.filter(assignee=user).alive()
```

### DOCUMENT (Документ)
```python
from apps.documents.models import Document

# Создание (с файлом)
document = Document.objects.create(
    title="Договор оказания услуг",
    file=file_object,  # из request.FILES
    deal=deal,
    owner=user,
    doc_type="Договор",
    status="signed"
)

# Получить все документы сделки
docs = deal.documents.alive()

# Получить размер файла
print(f"Размер: {document.file_size} байт")
```

### NOTE (Заметка)
```python
from apps.notes.models import Note

# Создание
note = Note.objects.create(
    deal=deal,
    body="Клиент просил скидку 15%. Нужно согласовать.",
    author_name="Иван Иванов"
)

# Получить все заметки сделки
notes = deal.notes.alive().order_by('-created_at')
```

### PAYMENT (Платёж)
```python
from apps.finances.models import Payment, Income, Expense

# Создание платежа
payment = Payment.objects.create(
    deal=deal,
    amount=25000,
    description="Авансовый платёж",
    scheduled_date="2025-12-15",
    status=Payment.PaymentStatus.PLANNED
)

# Создание дохода
income = Income.objects.create(
    payment=payment,
    amount=25000,
    received_at="2025-12-15",
    source="Счёт 12345",
    note="Получено от клиента"
)

# Создание расхода
expense = Expense.objects.create(
    payment=payment,
    amount=2000,
    expense_type="Комиссия",
    expense_date="2025-12-15"
)

# Получить все платежи сделки
payments = deal.payments.alive()
```

### NOTIFICATION (Уведомление)
```python
from apps.notifications.models import Notification

# Создание
notification = Notification.objects.create(
    user=user,
    type="deal_created",
    payload={
        "deal_id": str(deal.id),
        "deal_title": deal.title,
        "seller": deal.seller.username
    }
)

# Получить непрочитанные
unread = user.notifications.filter(is_read=False).alive()

# Отметить как прочитано
notification.mark_as_read()

# Проверить, прочитано ли
if notification.is_read:
    print(f"Прочитано в {notification.read_at}")
```

---

## Soft Delete операции

```python
# Удаление (soft)
obj.delete()

# Жёсткое удаление
obj.hard_delete()

# Восстановление
obj.restore()

# Проверка, удалён ли объект
if obj.is_deleted():
    print("Объект удалён")

# Только активные (по умолчанию)
Model.objects.all()  # ≈ Model.objects.alive()

# Только удалённые
Model.objects.dead()

# Все (включая удалённые)
Model.objects.with_deleted()

# Восстановить все удалённые
for obj in Model.objects.dead():
    obj.restore()
```

---

## Фильтрация и выборки

```python
# По статусу
open_deals = Deal.objects.filter(status=Deal.DealStatus.OPEN)

# По суме (больше 10000)
big_deals = Deal.objects.filter(amount__gte=10000)

# По периоду
from django.utils import timezone
from datetime import timedelta

week_ago = timezone.now() - timedelta(days=7)
recent = Deal.objects.filter(created_at__gte=week_ago)

# По владельцу
my_deals = Deal.objects.filter(seller=user)

# Комбинированные фильтры
my_active = Deal.objects.filter(
    seller=user,
    status=Deal.DealStatus.OPEN
).alive()

# Исключение
not_lost = Deal.objects.exclude(status=Deal.DealStatus.LOST)

# Количество
count = Deal.objects.alive().count()

# Сортировка
by_date = Deal.objects.order_by('-created_at')
by_amount = Deal.objects.order_by('-amount')
```

---

## Агрегация и статистика

```python
from django.db.models import Sum, Count, Avg

# Общая сумма всех открытых сделок
total = Deal.objects.filter(
    status=Deal.DealStatus.OPEN
).aggregate(total=Sum('amount'))
print(total['total'])  # или 0 если None

# Количество сделок по статусам
from django.db.models import Q
won_count = Deal.objects.filter(status=Deal.DealStatus.WON).count()
lost_count = Deal.objects.filter(status=Deal.DealStatus.LOST).count()

# Средняя сумма
avg_amount = Deal.objects.aggregate(avg=Avg('amount'))

# Количество задач на сделку
from django.db.models import Count
deals_with_tasks = Deal.objects.annotate(task_count=Count('tasks'))
```

---

## Сложные запросы

```python
# Сделки с полисами
deals_with_policies = Deal.objects.filter(policies__isnull=False).distinct()

# Сделки БЕЗ полисов
deals_without_policies = Deal.objects.filter(policies__isnull=True)

# Клиенты со сделками на сумму > 100000
from django.db.models import Q
big_clients = Client.objects.filter(
    deals__amount__gt=100000
).distinct()

# Мои задачи, отсортированные по приоритету
my_tasks = Task.objects.filter(assignee=user).order_by(
    'priority',  # приоритет сначала
    'due_at'      # потом срок
)
```

---

## Работа с связанными объектами

```python
# Создание через related_name
deal = Deal.objects.first()

# Получить все задачи
all_tasks = deal.tasks.all()

# Фильтрация через reverse relation
active_tasks = deal.tasks.filter(status=Task.TaskStatus.TODO)

# Добавление
new_task = Task.objects.create(deal=deal, title="Новая задача")

# Через связь
task = Task.objects.create(title="Новая", deal=deal)

# Удаление всех связанных
deal.delete()  # soft delete удалит все task, document, note, policy, payment
```

---

## Трансакции

```python
from django.db import transaction

# Безопасное создание множества объектов
with transaction.atomic():
    deal = Deal.objects.create(...)
    policy = Policy.objects.create(deal=deal, ...)
    task = Task.objects.create(deal=deal, ...)
    # Если что-то пойдёт не так, всё откатится
```

---

## Примечания

- **Все модели используют UUID первичные ключи**
- **Deal - центральная сущность**, на неё замыкаются Task, Document, Note, Policy, Payment
- **Soft Delete автоматический** - все операции .delete() - это soft delete
- **Каскадное удаление** - удаление Deal удаляет все связанные объекты
- **Примечания хранятся в Note**, не в отдельных полях
- **Seller и Executor могут быть пустыми** (null=True, blank=True)

