# Domain invariants

## —татусы/типы (фиксированные)
- `Task.status`: `todo`, `in_progress`, `done`, `overdue`, `canceled`.
- `Task.priority`: `low`, `normal`, `high`, `urgent`.
- `Document.status`: `draft`, `pending`, `completed`, `error`.
- `Statement.statement_type`: `income`, `expense`.
- `Statement.status`: `draft`, `paid`.

## —татусы/типы (нефиксированные)
- `Deal.status`: свободный текст, не нормализован.
- `Policy.status`: свободный текст, не нормализован.

## —в€зи и каскады
- ”даление сделки удал€ет св€занные полисы, платежи, задачи (м€гкое удаление через `SoftDeleteModel`).
- ”даление полиса удал€ет св€занные платежи (м€гкое удаление).
- ”даление платежа удал€ет св€занные финансовые записи.
- ”даление ведомости отв€зывает финансовые записи (`statement = null`).

## ќграничени€ данных
- `Policy.number` уникален среди не удаленных записей (`policies_unique_active_number`).
- `Payment` нельз€ удалить, если `actual_date` заполнена (платеж оплачен).
- `Document.file_size` заполн€етс€ автоматически при сохранении файла.
- `NotificationDelivery` уникален по (`user`, `event_type`, `object_type`, `object_id`, `trigger_date`).

## јвтозаполнение и согласование
- `Policy.save()` подт€гивает `client` и `insured_client` из `Deal`, если не заданы.

## «амечани€
- Ќет централизованного источника правды дл€ статусов сделок/полисов между backend и frontend.
