# Architecture (as-is)

## Backend: module map
- `backend/config/`: Django settings, URLs, ASGI/WSGI, admin customization, DRF router.
- `backend/apps/common/`: base модели (SoftDelete), общие сервисы/permissions/pagination/drive helpers.
- `backend/apps/users/`: роли, права, аудит, auth endpoints.
- `backend/apps/clients/`: клиенты + фильтры/сервисы/импорт.
- `backend/apps/deals/`: сделки, расчеты (quotes), справочники страховых/типов/каналов, view_mixins.
- `backend/apps/tasks/`: задачи и статусы, фильтры/сигналы.
- `backend/apps/documents/`: документы, распознавание, Open Notebook, knowledge endpoints.
- `backend/apps/notifications/`: уведомления, настройки, Telegram интеграция.
- `backend/apps/finances/`: платежи, финзаписи, ведомости.
- `backend/apps/notes/`: заметки по сделке.
- `backend/apps/chat/`: сообщения чата по сделке.
- `backend/apps/policies/`: полисы.

## Backend: входные точки
- `backend/config/urls.py`: health + auth + knowledge + notifications + finance summary + seller dashboard + router.
- `backend/config/api_router.py`: DRF viewsets для основных сущностей.

## Frontend: module map
- `frontend/src/App.tsx`, `frontend/src/AppContent.tsx`: корневой UI, auth, состояние, модалки.
- `frontend/src/components/app/`: маршруты и модалки.
- `frontend/src/components/views/`: страницы (Deals, Clients, Policies, Commissions, Tasks, Knowledge, Settings, SellerDashboard).
- `frontend/src/components/views/dealsView/`: крупный подпакет (панели, табы, хуки).
- `frontend/src/components/forms/`: формы (клиент, сделка, расчет, полис, платеж, задача, финзапись).
- `frontend/src/api/`: API-клиент и мапперы.
- `frontend/src/hooks/`: хранилище/фильтры/состояния UI.
- `frontend/src/utils/`: бизнес-утилиты (полисы, задачи, финансы и т.д.).
- `frontend/src/contexts/`: уведомления.

## Frontend: входные точки
- `frontend/src/main.tsx`: точка входа приложения.
- `frontend/src/components/app/AppRoutes.tsx`: маршруты UI.

## Где живет бизнес-логика (as-is)
- Backend: частично в моделях (save/delete), частично в views/serializers/services, а также в signals и утилитах common.
- Frontend: в `AppContent` (оркестрация), `views/*` и утилитах `utils/*`.
- Выраженных слоев домена/приложения нет; логика распределена по слоям транспорта.
