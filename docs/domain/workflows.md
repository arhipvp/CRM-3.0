# Domain workflows (end-to-end)

## 1) Создание клиента и сделки

1. UI: `/clients` -> создать клиента.
2. API: `POST /api/v1/clients/`.
3. UI: `/deals` -> создать сделку.
4. API: `POST /api/v1/deals/`.

## 2) Расчет и оформление полиса

1. UI: в сделке создать расчет.
2. API: `POST /api/v1/quotes/`.
3. UI: создать полис из сделки; для КАСКО можно указать франшизу, официального дилера и риск GAP. Продление отмечается отдельно во вкладке полисов сделки.
4. API: `POST /api/v1/policies/` (подтягивается client/insured_client; КАСКО-параметры сохраняются в полисе, без автосвязи с расчетами). Признак продления меняется через `PATCH /api/v1/policies/<id>/` с `is_renewed`.

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
5. При отметке задачи выполненной можно указать комментарий выполнения; он сохраняется в задаче, отображается в таблице и добавляется в Telegram-уведомление.

## 6) Документы и распознавание

1. UI: загрузка документа в сделке.
2. API: `POST /api/v1/documents/`.
3. Запуск распознавания.
4. API: `POST /api/v1/documents/recognize/` (JWT required).

## 7) Knowledge / Open Notebook

1. UI: `/knowledge` -> работа с источниками/ноутбуками.
2. API: `GET/POST /api/v1/knowledge/sources/` и `/api/v1/knowledge/notebooks/`.
3. Диалог: `POST /api/v1/knowledge/ask/` (JWT required).

## 8) Чат по сделке

1. UI: вкладка чата в сделке.
2. API: `GET /api/v1/chat_messages/?deal=<id>`.
3. Отправка сообщения: `POST /api/v1/chat_messages/`.

## 9) Уведомления и Telegram

1. UI: `/settings` -> настройка уведомлений.
2. API: `GET/PUT /api/v1/notifications/settings/`.
3. Привязка Telegram: `POST /api/v1/notifications/telegram-link/`.
4. Пользователь открывает ссылку/бота и отправляет `/start <код>`.
5. Bot: сохраняет `TelegramProfile.chat_id`.
6. Backend: отправляет пользователю Telegram-уведомления о задачах, сделках, оплатах и полисах.
7. Работа со сделками и документами через Telegram-бота отключена; файлы загружаются через UI/API CRM.

## 10) Аутентификация

1. UI: login.
2. API: `POST /api/v1/auth/login/` -> JWT.
3. Обновление токена: `POST /api/v1/auth/refresh/`.

## 11) Закрытие сделки

1. UI: карточка сделки -> закрыть (выбор `won`/`lost`, указать причину).
2. API: `POST /api/v1/deals/<id>/close/`.
3. Backend: валидация статуса (`won`/`lost`) и сохранение `closing_reason`.

## 12) Изменение статуса полиса

1. UI: список полисов / карточка -> изменить статус (active/inactive/canceled).
2. API: `PATCH /api/v1/policies/<id>/`.
3. Backend: валидация статуса и сохранение значения.

## 13) Ручная обработка дублей клиентов

1. UI: списки клиентов, сделок и полисов показывают тихий индикатор рядом с ФИО, если для клиента есть кандидаты на слияние или ФИО можно безопасно нормализовать.
2. API: `POST /api/v1/clients/duplicate-hints/` принимает `client_ids` и возвращает подсказки пачкой: количество кандидатов, максимальный score/confidence, причины совпадения и preview нормализованного ФИО.
3. UI: клик по индикатору дублей открывает ручной просмотр кандидатов; кнопка `Объединить` у кандидата сразу открывает merge preview для выбранной пары. Автоматического объединения нет.
4. API: `GET /api/v1/clients/similar/` возвращает кандидатов с причинами, score и счетчиками связанных сделок/полисов.
5. UI: клик по индикатору нормализации показывает подтверждение `было -> станет`.
6. API: `POST /api/v1/clients/<id>/normalize-name/` меняет только `name`, сохраняет audit log и не запускается автоматически при обычном сохранении клиента.
