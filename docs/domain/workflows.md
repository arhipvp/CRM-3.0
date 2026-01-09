# Domain workflows (end-to-end)

## 1) Создание клиента и сделки
1. UI: `/clients` -> создать клиента.
2. API: `POST /api/v1/clients/`.
3. UI: `/deals` -> создать сделку.
4. API: `POST /api/v1/deals/`.

## 2) Расчет и оформление полиса
1. UI: в сделке создать расчет.
2. API: `POST /api/v1/quotes/`.
3. UI: создать полис из сделки.
4. API: `POST /api/v1/policies/` (подтягивается client/insured_client).

## 3) Платежи и финансовые записи
1. UI: добавить платеж по полису.
2. API: `POST /api/v1/payments/`.
3. UI: добавить финзапись (доход/расход).
4. API: `POST /api/v1/financial_records/`.

## 4) Ведомости (income/expense)
1. UI: `/commissions` -> создать ведомость.
2. API: `POST /api/v1/finance_statements/`.
3. Добавить/удалить записи в ведомости.
4. API: `PATCH /api/v1/finance_statements/<id>/`.

## 5) Задачи по сделке
1. UI: `/deals` -> добавить задачу.
2. API: `POST /api/v1/tasks/`.
3. Изменение статуса/сроков.
4. API: `PATCH /api/v1/tasks/<id>/`.

## 6) Документы и распознавание
1. UI: загрузка документа в сделке.
2. API: `POST /api/v1/documents/`.
3. Запуск распознавания.
4. API: `POST /api/v1/documents/recognize/`.

## 7) Knowledge / Open Notebook
1. UI: `/knowledge` -> работа с источниками/ноутбуками.
2. API: `GET/POST /api/v1/knowledge/sources/` и `/api/v1/knowledge/notebooks/`.
3. Диалог: `POST /api/v1/knowledge/ask/`.

## 8) Чат по сделке
1. UI: вкладка чата в сделке.
2. API: `GET /api/v1/chat_messages/?deal=<id>`.
3. Отправка сообщения: `POST /api/v1/chat_messages/`.

## 9) Уведомления и Telegram
1. UI: `/settings` -> настройка уведомлений.
2. API: `GET/PUT /api/v1/notifications/settings/`.
3. Привязка Telegram: `POST /api/v1/notifications/telegram-link/`.

## 10) Аутентификация
1. UI: login.
2. API: `POST /api/v1/auth/login/` -> JWT.
3. Обновление токена: `POST /api/v1/auth/refresh/`.
