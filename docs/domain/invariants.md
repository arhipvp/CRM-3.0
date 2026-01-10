# Domain invariants

## Статусы/типы (фиксированные)
- `Task.status`: `todo`, `in_progress`, `done`, `overdue`, `canceled`.
- `Task.priority`: `low`, `normal`, `high`, `urgent`.
- `Document.status`: `draft`, `pending`, `completed`, `error`.
- `Statement.statement_type`: `income`, `expense`.
- `Statement.status`: `draft`, `paid`.

## Статусы/типы (нефиксированные)
- `Deal.status`: свободный текст, не нормализован.
- `Policy.status`: свободный текст, не нормализован.


## Инвентаризация статусов и источников правды (backend/frontend)
- `Deal.status`
  - Backend: `backend/apps/deals/models.py` (строка), default `open`.
  - Backend поведение: `backend/apps/deals/views.py` закрытие/открытие допускает только `won`/`lost`, `reopen` возвращает `open`, `CLOSED_STATUSES = {"won", "lost"}`.
  - Backend админ: `backend/apps/deals/admin.py` действия ставят `won`, `lost`, `on_hold`.
  - Backend фильтры: `backend/apps/deals/filters.py` описывает `open`, `won`, `lost`, `on_hold`.
  - Frontend типы: `frontend/src/types.ts` и `frontend/src/types/index.ts` — `DealStatus = 'open' | 'won' | 'lost' | 'on_hold'`.
  - Frontend маппинг: `frontend/src/api/mappers.ts` валидирует значения и при неизвестном ставит `open`.
- `Deal.stage_name`
  - Backend: строка без enum в `backend/apps/deals/models.py`.
  - Frontend: строка в `frontend/src/types.ts`/`frontend/src/types/index.ts`.
  - Нет центрального списка стадий, используется как произвольный текст.
- `Policy.status`
  - Backend: `backend/apps/policies/models.py` (строка), default `active`.
  - Backend админ: `backend/apps/policies/admin.py` использует `active`/`inactive` действия; бейдж вычисляет активность по датам, не по `status`.
  - Backend фильтры: `backend/apps/policies/filters.py` упоминает `active`, `expired`, `cancelled` (описание), но без enum.
  - Frontend типы: `frontend/src/types.ts` — `status: string`; `frontend/src/types/index.ts` — `status?: string`.
  - Frontend маппинг: `frontend/src/api/mappers.ts` пропускает строку как есть (без нормализации).
- `Task.status`
  - Backend: enum `TaskStatus` в `backend/apps/tasks/models.py` (`todo`, `in_progress`, `done`, `overdue`, `canceled`).
  - Frontend типы: `frontend/src/types.ts` — `TaskStatus` с тем же набором.
  - Frontend маппинг: `frontend/src/api/mappers.ts` валидирует набор и по умолчанию ставит `todo`.
- `Document.status`
  - Backend: enum `DocumentStatus` в `backend/apps/documents/models.py` (`draft`, `pending`, `completed`, `error`).
  - Frontend: отдельного типа нет, статус в UI напрямую не используется.
- `Statement.status` / `Statement.statement_type`
  - Backend: enum-like choices в `backend/apps/finances/models.py` (`draft`/`paid`, `income`/`expense`).
  - Frontend типы: `frontend/src/types.ts` (`StatementStatus`, `StatementType`).
  - Frontend маппинг: `frontend/src/api/mappers.ts` приводит к строке и кастит к типам (без валидации).
- `PolicyRecognitionResult.status` (распознавание полисов)
  - Backend: `backend/apps/policies/views.py` возвращает `parsed` или `error`.
  - Frontend типы: `frontend/src/types.ts` допускает `parsed`, `error`, `exists`.
  - Gap: `exists` в backend не встречается.



## Контракт статусов (target)
- `Deal.status`:
  - `open` — активная сделка.
  - `on_hold` — приостановлена, но не закрыта.
  - `won` — закрыта успешно.
  - `lost` — закрыта с проигрышем.
  - Закрытые статусы: `won`, `lost`.
  - Переходы: `open` <-> `on_hold`, `open|on_hold` -> `won|lost`, `won|lost` -> `open` (reopen).
- `Policy.status`:
  - `active` — действует.
  - `inactive` — временно не активен (ручной статус).
  - `expired` — срок действия истек (может вычисляться по `end_date`).
  - `canceled` — отменен (ручной статус).
  - Если `end_date` < today, UI может отображать `expired` независимо от значения поля.

## План миграции статусов (Deal/Policy)
1. Зафиксировать финальные названия enum (например, `canceled` vs `cancelled`) и описания.
2. Backend: добавить TextChoices/валидацию в моделях и сериализаторах; на запись принимать legacy значения и маппить в новый enum.
3. Backend: написать миграцию данных — нормализовать значения (`open`, `on_hold`, `won`, `lost`, `active`, `inactive`, `expired`, `canceled`) с учетом регистра и синонимов.
4. Frontend: обновить типы/мапперы, добавить fallback для неизвестных значений на время миграции.
5. После 1-2 релизов: удалить поддержку legacy-значений и упростить маппинг.

## Связи и каскады
- Удаление сделки удаляет связанные полисы, платежи, задачи (мягкое удаление через `SoftDeleteModel`).
- Удаление полиса удаляет связанные платежи (мягкое удаление).
- Удаление платежа удаляет связанные финансовые записи.
- Удаление ведомости отвязывает финансовые записи (`statement = null`).

## Ограничения данных
- `Policy.number` уникален среди не удаленных записей (`policies_unique_active_number`).
- `Payment` нельзя удалить, если `actual_date` заполнена (платеж оплачен).
- `Document.file_size` заполняется автоматически при сохранении файла.
- `NotificationDelivery` уникален по (`user`, `event_type`, `object_type`, `object_id`, `trigger_date`).

## Автозаполнение и согласование
- `Policy.save()` подтягивает `client` и `insured_client` из `Deal`, если не заданы.

## Замечания
- Нет централизованного источника правды для статусов сделок/полисов между backend и frontend.
