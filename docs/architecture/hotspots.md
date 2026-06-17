# Architecture hotspots

## High

- `frontend/src/features/app/*-shell`: orchestration теперь разнесён по shell-модулям, но это всё ещё чувствительный слой интеграции между auth/data/actions/routes/overlays.
- `frontend/src/components/views/dealsView/`: крупный набор взаимосвязанных компонентов и хуков, высокая связанность логики сделок/полисов/платежей.
- `backend/apps/deals/views.py` + `backend/apps/deals/view_mixins/*`: смешение доменной логики и транспорта, сложные операции (merge/restore/history/drive).
- Интеграции: Google Drive / Open Notebook / Telegram / AI (OpenRouter) — внешние зависимости с нетривиальным поведением.

## Notes

- `frontend/src/AppContent.tsx` больше не является primary hotspot: файл сведен к thin-root composition, а основной риск перенесён в feature-shell contracts.
- Часть чистой логики финансов и полисов вынесена из appContent hooks в `frontend/src/hooks/appContent/*Helpers.ts`; при новых правках сначала ищи существующий helper, а не добавляй вычисления обратно в hook.
- Сохранение формы полиса больше не orchestrated hotspot во frontend: `usePolicyActions` вызывает draft endpoints, а атомарная операция policy+payments+financial records живёт в `backend/apps/policies/services/finance.py`.
- Перенос, Drive-файлы и правила удаления полисов вынесены из `backend/apps/policies/views.py` в `backend/apps/policies/services/{move,files,delete}.py`; viewset должен оставаться HTTP/permissions/serializer слоем.
- Распознавание полисов и Drive orchestration для `/policies/recognize/` вынесены в `backend/apps/policies/services/recognition.py`; новые fallback/AI/Drive правила добавлять туда, не во viewset.
- Распознавание документов сделок для `/deals/{id}/recognize-documents/` вынесено в `backend/apps/deals/document_recognition_service.py`; Drive/download/parser/note/audit правила держать в service, не в mixin.
- Time tracking сделок вынесен из `backend/apps/deals/views.py` в `backend/apps/deals/time_tracking_service.py`; viewset должен оставаться HTTP-обвязкой.
- Часть правил ведомостей и Drive-именования вынесена из `backend/apps/finances/views.py` в `backend/apps/finances/services/statements.py`.

## Medium

- Статусы и enum'ы: часть статусов свободный текст (`Deal.status`), часть фиксированная (Tasks/Document/Statement). `Policy.status` оставлен legacy-полем, новые потоки должны опираться на computed status и `is_renewed`.
- Soft delete и каскады (`Deal.delete`, `Policy.delete`, `Payment.delete`): поведенческие зависимости на уровне моделей.
- Финансы (`Payment`, `FinancialRecord`, `Statement`): правила удаления/привязки и вычислений распределены по слоям.

## Low

- `frontend/src/api/*`: мапперы и helpers могут дублировать преобразования, но изменения обычно локальные.
- `backend/apps/common/*`: много общих утилит, риск незаметных побочных эффектов при правках.
