#!/usr/bin/env python
"""
Скрипт для заполнения БД тестовыми данными
Запуск: python manage.py shell < populate_test_data.py
"""

import uuid

from apps.chat.models import ChatMessage
from apps.clients.models import Client
from apps.deals.models import (
    ActivityLog,
    Deal,
    InsuranceCompany,
    InsuranceType,
    Quote,
)
from apps.documents.models import Document
from apps.finances.models import FinancialRecord, Payment
from apps.notes.models import Note
from apps.notifications.models import Notification
from apps.policies.models import Policy
from apps.tasks.models import Task
from apps.users.models import Role, UserRole
from django.contrib.auth.models import User
from django.db.models import Q
from django.utils import timezone

print("=== Создаю тестовые данные ===\n")

# 1. Создаю администратора и обычных пользователей
print("1. Создание пользователей...")
users = []

# Получаю или создаю админа
admin, created = User.objects.get_or_create(
    username="admin",
    defaults={"email": "admin@test.com", "first_name": "Admin", "last_name": "User"},
)
if created:
    admin.set_password("admin123")
    admin.save()
users.append(admin)

for i in range(1, 5):
    user, created = User.objects.get_or_create(
        username="user{}".format(i),
        defaults={
            "email": "user{}@test.com".format(i),
            "first_name": "User{}".format(i),
            "last_name": "Test{}".format(i),
        },
    )
    if created:
        user.set_password("password123")
        user.save()
    users.append(user)
print("   OK: {} polzovatelei\n".format(len(users)))

# 2. Создаю роли
print("2. Создание ролей...")
admin_role, _ = Role.objects.get_or_create(
    name="Admin", defaults={"description": "Administrator role with full access"}
)
user_role, _ = Role.objects.get_or_create(
    name="User", defaults={"description": "Regular user role"}
)
print("   OK: 2 роли\n")

# 3. Назначаю роли пользователям
print("3. Назначение ролей пользователям...")
UserRole.objects.get_or_create(user=admin, role=admin_role)
for user in users[1:]:
    UserRole.objects.get_or_create(user=user, role=user_role)
print("   OK: Роли назначены\n")

# 4. Создаю клиентов
print("4. Создание клиентов...")
clients = []
client_data = [
    ("ООО Рога и Копыта", "+79991234567"),
    ("ИП Иванов И.И.", "+79992345678"),
    ('Компания "Альфа"', "+79993456789"),
    ('ЗАО "Бета"', "+79994567890"),
    ('ООО "Гамма"', "+79995678901"),
    ("ИП Петров П.П.", "+79996789012"),
    ('Компания "Дельта"', "+79997890123"),
]
for name, phone in client_data:
    client = Client.objects.create(name=name, phone=phone, birth_date="1980-01-15")
    clients.append(client)
print("   OK: {} клиентов\n".format(len(clients)))

# 5. Создаю сделки
print("5. Создание сделок...")
deals = []
deal_statuses = ["open", "in_progress", "won", "lost"]
for i, client in enumerate(clients[:6]):
    deal = Deal.objects.create(
        client=client,
        title="Sdelka #{}: {}".format(i + 1, client.name),
        description="Opisanie sdelki dlya {}".format(client.name),
        seller=users[1 + (i % 3)],
        executor=users[2 + (i % 2)],
        status=deal_statuses[i % 4],
        stage_name="Peregovory" if i % 2 == 0 else "Predlozhenie",
        expected_close=timezone.now().date() + timezone.timedelta(days=30 + i * 5),
    )
    deals.append(deal)
print("   OK: {} sdelok\n".format(len(deals)))

# 6. Создаю котировки
print("6. Создание котировок...")
quotes = []
for i, deal in enumerate(deals):
    for j in range(2):
        company_name = "Strahovaya kompaniya #{}".format((i + j) % 3 + 1)
        company, _ = InsuranceCompany.objects.get_or_create(name=company_name)
        type_name = ["liability", "property", "auto", "health"][j % 4]
        insurance_type, _ = InsuranceType.objects.get_or_create(name=type_name)
        quote = Quote.objects.create(
            deal=deal,
            insurance_company=company,
            insurance_type=insurance_type,
            sum_insured=500000 + (i + j) * 50000,
            premium=50000 + (i + j) * 10000,
            deductible="10%" if j == 0 else "20%",
            comments="Kotirovka #{} dlya {}".format(j + 1, deal.title),
        )
        quotes.append(quote)
print("   OK: {} kotirovok\n".format(len(quotes)))

# 7. Создаю логи активности
print("7. Создание логов активности...")
activities = []
action_types = [
    "created",
    "status_changed",
    "stage_changed",
    "description_updated",
    "assigned",
    "policy_created",
    "quote_added",
]
for i, deal in enumerate(deals):
    for j in range(2):
        activity = ActivityLog.objects.create(
            deal=deal,
            user=users[1 + (i % 3)],
            action_type=action_types[j % len(action_types)],
            description="Deystvie #{}: {} dlya {}".format(
                j + 1, action_types[j % len(action_types)], deal.title
            ),
            old_value="",
            new_value="",
        )
        activities.append(activity)
print("   OK: {} zapisey logov\n".format(len(activities)))

# 8. Создаю задачи
print("8. Создание zadach...")
tasks = []
statuses = ["todo", "in_progress", "done"]
priorities = ["low", "normal", "high", "urgent"]
for i, deal in enumerate(deals):
    for j in range(2):
        task = Task.objects.create(
            deal=deal,
            title="Zadacha #{}: {}".format(j + 1, deal.title),
            description="Opisanie zadachi dlya {}".format(deal.title),
            status=statuses[j % len(statuses)],
            priority=priorities[j % len(priorities)],
            due_at=timezone.now() + timezone.timedelta(days=7 + i),
            assignee=users[1 + (i % 3)],
            created_by=users[1 + (i % 3)],
            checklist=[],
        )
        tasks.append(task)
print("   OK: {} zadach\n".format(len(tasks)))

# 9. Создаю документы
print("9. Создание dokumentov...")
documents = []
doc_types = ["contract", "invoice", "specification", "proposal"]
statuses = ["draft", "approved", "archived"]
for i, deal in enumerate(deals):
    for j in range(2):
        doc = Document.objects.create(
            deal=deal,
            title="Dokument #{}: {}".format(j + 1, deal.title),
            doc_type=doc_types[j % len(doc_types)],
            file="documents/{}/doc_{}.pdf".format(deal.id, j + 1),
            file_size=100000 + (i + j) * 10000,
            mime_type="application/pdf",
            owner=users[1 + (i % 3)],
            status=statuses[j % len(statuses)],
            checksum="sha256_{}".format(i * 100 + j),
        )
        documents.append(doc)
print("   OK: {} dokumentov\n".format(len(documents)))

# 10. Создаю платежи и финансовые записи
print("10. Создание platezhey i finansovykh zapisey...")
payments = []
financial_records = []
payment_statuses = ["planned", "partial", "paid"]
for i, deal in enumerate(deals):
    for j in range(2):
        payment = Payment.objects.create(
            deal=deal,
            amount=100000 + i * 10000 + j * 5000,
            status=payment_statuses[j % len(payment_statuses)],
            description="Platezh #{} dlya {}".format(j + 1, deal.title),
            scheduled_date=timezone.now().date() + timezone.timedelta(days=15 + i),
            actual_date=timezone.now().date() if j == 1 else None,
        )
        payments.append(payment)

        # Создаю финансовую запись
        record = FinancialRecord.objects.create(
            payment=payment,
            amount=payment.amount,
            date=timezone.now().date(),
            description="Finansovaya zapis dlya {}".format(deal.title),
            source="Deal payment",
            note="Record for deal payment",
        )
        financial_records.append(record)

print(
    "   OK: {} platezhey i {} finansovykh zapisey\n".format(
        len(payments), len(financial_records)
    )
)

# 11. Создаю заметки
print("11. Создание zametok...")
notes = []
for i, deal in enumerate(deals):
    for j in range(2):
        note = Note.objects.create(
            deal=deal,
            body="Zametka #{}: Vazhnaya informaciya o {}. Detalnyy tekst zametki.".format(
                j + 1, deal.title
            ),
            author_name=users[1 + (i % 3)].get_full_name(),
        )
        notes.append(note)
print("   OK: {} zametok\n".format(len(notes)))

# 12. Создаю полисы
print("12. Создание polisov...")
policies = []
insurance_types = ["liability", "property", "auto", "health"]
policy_statuses = ["active", "inactive"]
for i, deal in enumerate(deals):
    for j in range(2):
        company_name = "Strakhovaya kompaniya #{}".format((i + j) % 3 + 1)
        insurance_company, _ = InsuranceCompany.objects.get_or_create(name=company_name)
        type_name = insurance_types[j % len(insurance_types)]
        insurance_type, _ = InsuranceType.objects.get_or_create(name=type_name)

        policy = Policy.objects.create(
            deal=deal,
            number="POL-{}-{}".format(str(deal.id).replace("-", "")[:8].upper(), j + 1),
            insurance_type=insurance_type,
            insurance_company=insurance_company,
            is_vehicle=j % 2 == 0,
            brand="Brand {}".format(j + 1),
            model="Model {}".format(j + 1),
            vin="VIN{:012d}".format(i * 100 + j),
            start_date=timezone.now().date(),
            end_date=timezone.now().date() + timezone.timedelta(days=365),
            status=policy_statuses[j % len(policy_statuses)],
        )
        policies.append(policy)
print("   OK: {} polisov\n".format(len(policies)))

# 13. Создаю сообщения в чате
print("13. Создание soobshcheniy v chate...")
chat_messages = []
for i, deal in enumerate(deals):
    for j in range(2):
        user = users[1 + (i % 3)]
        msg = ChatMessage.objects.create(
            deal=deal,
            author=user,
            author_name=user.get_full_name(),
            body="Soobshchenie #{} v chate dlya sdelki {}. Tekst soobshcheniya.".format(
                j + 1, deal.title
            ),
        )
        chat_messages.append(msg)
print("   OK: {} soobshcheniy v chate\n".format(len(chat_messages)))

# 14. Создаю уведомления
print("14. Создание uvedomleniy...")
notifications = []
notification_types = ["info", "warning", "error", "success"]
for i, user in enumerate(users):
    for j in range(2):
        notification = Notification.objects.create(
            user=user,
            type=notification_types[j % len(notification_types)],
            payload={
                "title": "Uvedomlenie #{}".format(j + 1),
                "message": "Eto uvedomlenie dlya {}".format(user.get_full_name()),
            },
            is_read=False,
        )
        notifications.append(notification)
print("   OK: {} uvedomleniy\n".format(len(notifications)))

print("=" * 60)
print("OK: VSE TESTOVYE DANNYE USPESHNO SOZDANY!")
print("=" * 60)
print("\nSvodka:")
print("  Users: {}".format(User.objects.count()))
print("  Roles: {}".format(Role.objects.count()))
print("  Clients: {}".format(Client.objects.count()))
print("  Deals: {}".format(Deal.objects.count()))
print("  Quotes: {}".format(Quote.objects.count()))
print("  Tasks: {}".format(Task.objects.count()))
print("  Documents: {}".format(Document.objects.count()))
print("  Payments: {}".format(Payment.objects.count()))
print("  FinancialRecords: {}".format(FinancialRecord.objects.count()))
print("  Notes: {}".format(Note.objects.count()))
print("  Policies: {}".format(Policy.objects.count()))
print("  ChatMessages: {}".format(ChatMessage.objects.count()))
print("  Notifications: {}".format(Notification.objects.count()))
print("\nDlya vkhoda ispolzuy:")
print("  Username: admin")
print("  Password: admin123")
