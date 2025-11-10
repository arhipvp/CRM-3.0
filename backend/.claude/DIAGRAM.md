# 📊 Диаграммы модели данных

## ER-диаграмма (Entity-Relationship)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        CRM 3.0 DATA MODEL DIAGRAM                             │
└──────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │    USER     │ (Django built-in)
                              │(auth.User)  │
                              └──────┬──────┘
                                     │
                    ┌────────────────┼────────────────┐
                    │                │                │
                    ▼                ▼                ▼
             (seller)          (executor)      (assignee/created_by)
                    │                │                │
                    │                │                │
    ┌───────────────────────────────────────────────────────────────┐
    │                                                               │
    │                    ┌─────────────────┐                        │
    │                    │     CLIENT      │                        │
    │                    ├─────────────────┤                        │
    │                    │ id (UUID) [PK]  │                        │
    │                    │ name (CharField)│                        │
    │                    │ phone (Char)    │                        │
    │                    │ birth_date      │                        │
    │                    │ deleted_at      │                        │
    │                    │ created_at      │                        │
    │                    │ updated_at      │                        │
    │                    └────────┬────────┘                        │
    │                             │                                 │
    │                      PROTECT │                                │
    │                             │                                 │
    │                             ▼                                 │
    │                  ┌──────────────────────┐                     │
    │                  │      DEAL ⭐         │ CENTRAL             │
    │                  ├──────────────────────┤                     │
    │                  │ id (UUID) [PK]       │                     │
    │                  │ title                │                     │
    │                  │ description          │                     │
    │                  │ client_id [FK]       │←────────────────────┤
    │                  │ seller_id [FK]       │────────────────────►│
    │                  │ executor_id [FK]     │────────────────────►│
    │                  │ probability          │                     │
    │                  │ status               │                     │
    │                  │ stage_name           │                     │
    │                  │ expected_close       │                     │
    │                  │ source               │                     │
    │                  │ loss_reason          │                     │
    │                  │ channel              │                     │
    │                  │ deleted_at           │                     │
    │                  │ created_at           │                     │
    │                  │ updated_at           │                     │
    │                  └────────┬─────────────┘                     │
    │                           │                                   │
    └───────────────────────────┼───────────────────────────────────┘
                                │
                CASCADE          │
           ┌────────┬───────────┬──────────┬───────────┐
           │        │           │          │           │
           ▼        ▼           ▼          ▼           ▼
      ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐ ┌────────┐
      │ TASK   │ │DOCUMENT│ │ NOTE   │ │ POLICY ⭐ │ │PAYMENT │
      ├────────┤ ├────────┤ ├────────┤ ├──────────┤ ├────────┤
      │id (PK) │ │id (PK) │ │id (PK) │ │id (PK)   │ │id (PK) │
      │title   │ │title   │ │body    │ │number    │ │amount  │
      │desc    │ │file    │ │author  │ │company   │ │deal_id │
      │deal_id │ │deal_id │ │deal_id │ │type      │ │status  │
      │assignee│ │owner   │ │...     │ │deal_id   │ │...     │
      │created_by│doc_type│ │        │ │vin       │ │        │
      │due_at  │ │status  │ │        │ │start_date│ │        │
      │status  │ │...     │ │        │ │end_date  │ │        │
      │priority│ │        │ │        │ │amount    │ │        │
      │...     │ │        │ │        │ │status    │ │        │
      │        │ │        │ │        │ │...       │ │        │
      └────────┘ └────────┘ └────────┘ └──────────┘ └────┬───┘
                                                         │
                                                CASCADE  │
                                              ┌──────────┴────────┐
                                              │                   │
                                              ▼                   ▼
                                         ┌────────┐          ┌─────────┐
                                         │ INCOME │          │ EXPENSE │
                                         ├────────┤          ├─────────┤
                                         │id (PK) │          │id (PK)  │
                                         │payment │          │payment  │
                                         │amount  │          │amount   │
                                         │rec_at  │          │exp_type │
                                         │source  │          │exp_date │
                                         │...     │          │...      │
                                         └────────┘          └─────────┘


                         ┌──────────────────────┐
                         │  NOTIFICATION       │
                         ├──────────────────────┤
                         │ id (UUID) [PK]       │
                         │ user_id [FK] [USER]  │
                         │ type                 │
                         │ payload (JSON)       │
                         │ is_read              │
                         │ read_at              │
                         │ deleted_at           │
                         │ created_at           │
                         │ updated_at           │
                         └──────────────────────┘
```

---

## Диаграмма наследования моделей

```
┌────────────────────────────┐
│   models.Model             │ (Django)
└────────┬───────────────────┘
         │
         ▼
┌────────────────────────────┐
│  SoftDeleteModel           │ (apps.common)
│ ────────────────────────   │
│ - id (UUID)                │
│ - created_at               │
│ - updated_at               │
│ - deleted_at               │
│                            │
│ Methods:                   │
│ - delete() [soft]          │
│ - hard_delete()            │
│ - restore()                │
│ - is_deleted()             │
│                            │
│ Manager:                   │
│ - objects.alive()          │
│ - objects.dead()           │
│ - objects.with_deleted()   │
└────────┬───────────────────┘
         │
    ┌────┴────────────────────────────────────────────────────────────┐
    │                                                                   │
    ▼                ▼                ▼                ▼              ▼
┌────────┐    ┌────────────┐    ┌──────────┐    ┌──────────┐   ┌─────────┐
│ Client │    │   Deal     │    │   Task   │    │Document  │   │  Note   │
└────────┘    └────────────┘    └──────────┘    └──────────┘   └─────────┘

    ▼                ▼                ▼                ▼              ▼
┌────────┐    ┌────────────┐    ┌──────────┐    ┌──────────┐   ┌─────────┐
│ Policy │    │  Payment   │    │  Income  │    │ Expense  │   │Notif.   │
└────────┘    └────────────┘    └──────────┘    └──────────┘   └─────────┘
```

---

## Иерархия связей (Deal как центр)

```
                           ┌──────────────┐
                           │    CLIENT    │
                           └──────┬───────┘
                                  │ PROTECT
                                  │
                                  ▼
                          ┌─────────────────┐
                          │      DEAL       │ ⭐ CENTER
                          └─────────────────┘
                                  │
                    ┌─────────────┼─────────────────┬──────────────┐
                    │             │                 │              │
                CASCADE        CASCADE          CASCADE        CASCADE
                    │             │                 │              │
    ┌───────────────┴──────┐  ┌───┴────┐  ┌──────┴────┐  ┌────────┴────┐
    │                      │  │        │  │           │  │             │
    ▼                      ▼  ▼        ▼  ▼           ▼  ▼             ▼
┌────────┐           ┌────────────┐ ┌────────┐ ┌──────────┐ ┌─────────────┐
│ TASK   │           │ DOCUMENT   │ │ NOTE   │ │ POLICY ⭐│ │  PAYMENT    │
└────────┘           └────────────┘ └────────┘ └──────────┘ └─────────────┘
                                                                  │
                                                      ┌───────────┴──────────┐
                                                      │                      │
                                                  CASCADE              CASCADE
                                                      │                      │
                                                      ▼                      ▼
                                                 ┌────────┐            ┌────────┐
                                                 │ INCOME │            │EXPENSE │
                                                 └────────┘            └────────┘
```

---

## Типы отношений

| От | К | Тип | ON DELETE | Описание |
|-------|---------|---------|-----------|----------|
| Deal | Client | Many:One | PROTECT | Нельзя удалить клиента со сделками |
| Deal | User (seller) | Many:One | SET_NULL | Продавец может быть удален |
| Deal | User (executor) | Many:One | SET_NULL | Исполнитель может быть удален |
| Task | Deal | Many:One | CASCADE | Удаление Deal удалит задачи |
| Document | Deal | Many:One | CASCADE | Удаление Deal удалит документы |
| Note | Deal | Many:One | CASCADE | Удаление Deal удалит заметки |
| Policy | Deal | Many:One | CASCADE | Удаление Deal удалит полисы |
| Payment | Deal | Many:One | CASCADE | Удаление Deal удалит платежи |
| Income | Payment | Many:One | CASCADE | Удаление Payment удалит доходы |
| Expense | Payment | Many:One | CASCADE | Удаление Payment удалит расходы |
| Notification | User | Many:One | CASCADE | Удаление User удалит уведомления |

---

## Диаграмма Soft Delete

```
┌─────────────────────────────────────────────────────────┐
│              SOFT DELETE MECHANISM                       │
└─────────────────────────────────────────────────────────┘

ОПЕРАЦИЯ                  deleted_at          IN QUERIES
─────────────────────────────────────────────────────────
Создание                  NULL           Видно в .all()

Soft delete()             NOW()          НЕ видно в .all()
                                         Видно в .with_deleted()

restore()                 NULL           Видно в .all()

hard_delete()             ❌ УДАЛЯ       ❌ Полностью удалено
                          ЕТ ИЗ БД


┌──────────────────────────────┐
│  QuerySet методы             │
├──────────────────────────────┤
│ .alive() - только активные   │
│ .dead()  - только удалённые  │
│ .with_deleted() - всё        │
└──────────────────────────────┘
```

---

## Пример жизненного цикла Deal

```
┌─────────────────────────────────────────────────────────────┐
│           DEAL LIFECYCLE (ЖИЗНЕННЫЙ ЦИКЛ)                  │
└─────────────────────────────────────────────────────────────┘

  1. СОЗДАНИЕ
     Deal.objects.create(...)
     │
     ├─ id: uuid4
     ├─ deleted_at: NULL
     ├─ created_at: NOW()
     └─ updated_at: NOW()

  2. ИСПОЛЬЗОВАНИЕ
     deal.save()
     │
     ├─ deleted_at: NULL (не меняется)
     └─ updated_at: NOW() (обновляется)

  3. SOFT DELETE
     deal.delete()
     │
     ├─ deleted_at: NOW()
     ├─ updated_at: NOW()
     │
     ├─ CASCADE для связанных:
     │  ├─ Task.delete()
     │  ├─ Document.delete()
     │  ├─ Note.delete()
     │  ├─ Policy.delete()
     │  └─ Payment.delete()
     │
     └─ PROTECT для CLIENT:
        └─ Client не удаляется!

  4. ВОССТАНОВЛЕНИЕ
     deal.restore()
     │
     ├─ deleted_at: NULL
     └─ updated_at: NOW()

  5. ЖЁСТКОЕ УДАЛЕНИЕ
     deal.hard_delete()
     │
     └─ ❌ ПОЛНОЕ УДАЛЕНИЕ ИЗ БД
```

---

## Статус-машина Deal

```
┌──────────────────────────────────────────────┐
│     DEAL STATUS MACHINE                      │
└──────────────────────────────────────────────┘

    ┌─────────────────────────────────────┐
    │          OPEN (по умолч.)           │
    │   Начальное состояние сделки        │
    └────────┬────────────────────────────┘
             │
     ┌───────┴──────────┐
     │                  │
     ▼                  ▼
  ┌──────┐          ┌─────────┐
  │ WON  │          │ LOST    │
  └──────┘          └─────────┘
     │                  │
     │  ┌──────────────┐│
     └─►│  ON_HOLD    ◄┘
        │  (ожидание)  │
        └──────────────┘
```

---

## Граф наследования Soft Delete

```
┌──────────────────────────┐
│  SoftDeleteModel         │
│  ────────────────────    │
│  Abstract model with:    │
│  - id (UUID)             │
│  - created_at            │
│  - updated_at            │
│  - deleted_at            │
│  - manager (SoftDelete)   │
│  - methods (delete, etc)  │
└────────────┬─────────────┘
             │
    ┌────────┴──────────────────────┐
    │                               │
    ▼                               ▼
┌─────────────────┐            ┌──────────────────┐
│   SOFT_DELETE   │            │   ALL_MODELS     │
│    ENABLED      │            │   INHERIT FROM   │
│  ────────────   │            │  SOFT_DELETE     │
│  • Client       │            │   ────────────   │
│  • Deal         │            │  • Task          │
│  • Policy ⭐    │            │  • Document      │
│  • Task         │            │  • Note          │
│  • Document     │            │  • Policy        │
│  • Note         │            │  • Payment       │
│  • Payment      │            │  • Income        │
│  • Income       │            │  • Expense       │
│  • Expense      │            │  • Notification  │
│  • Notification │            │                  │
└─────────────────┘            └──────────────────┘
```

---

## Размещение приложений

```
backend/
├── config/
│   ├── settings.py        ← Добавить apps.common и apps.policies
│   ├── urls.py
│   └── wsgi.py
│
├── apps/
│   ├── common/            ← ⭐ НОВОЕ
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── models.py      ← SoftDeleteModel, Manager, QuerySet
│   │   └── migrations/
│   │
│   ├── clients/
│   │   ├── models.py      ← Упрощённый Client
│   │   └── migrations/
│   │
│   ├── deals/
│   │   ├── models.py      ← Deal (ЦЕНТРАЛЬНАЯ)
│   │   └── migrations/
│   │
│   ├── policies/          ← ⭐ НОВОЕ
│   │   ├── __init__.py
│   │   ├── apps.py
│   │   ├── models.py      ← Policy
│   │   └── migrations/
│   │
│   ├── tasks/
│   │   ├── models.py
│   │   └── migrations/
│   │
│   ├── documents/
│   │   ├── models.py
│   │   └── migrations/
│   │
│   ├── notes/
│   │   ├── models.py
│   │   └── migrations/
│   │
│   ├── finances/
│   │   ├── models.py      ← Payment, Income, Expense
│   │   └── migrations/
│   │
│   ├── notifications/
│   │   ├── models.py
│   │   └── migrations/
│   │
│   └── users/
│       └── models.py
│
└── .claude/               ← ДОКУМЕНТАЦИЯ
    ├── README.md
    ├── DATA_MODEL.md
    ├── MIGRATIONS_GUIDE.md
    ├── QUICK_REFERENCE.md
    ├── CHANGES_SUMMARY.md
    └── DIAGRAM.md (этот файл)
```

---

## Заключение

Диаграммы показывают:
- ✅ **ER-диаграмма** - полная структура всех сущностей
- ✅ **Наследование** - как модели наследуют SoftDeleteModel
- ✅ **Иерархия** - Deal как центр, остальное вокруг
- ✅ **Отношения** - типы связей и ON DELETE поведение
- ✅ **Soft Delete** - механизм удаления и восстановления
- ✅ **Жизненный цикл** - как Deal создаётся и удаляется
- ✅ **Структура** - расположение файлов и приложений

