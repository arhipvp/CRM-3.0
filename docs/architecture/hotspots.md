# Architecture hotspots

## High
- `frontend/src/features/app/*-shell`: orchestration теперь разнесён по shell-модулям, но это всё ещё чувствительный слой интеграции между auth/data/actions/routes/overlays.
- `frontend/src/components/views/dealsView/`: крупный набор взаимосвязанных компонентов и хуков, высокая связанность логики сделок/полисов/платежей.
- `backend/apps/deals/views.py` + `backend/apps/deals/view_mixins/*`: смешение доменной логики и транспорта, сложные операции (merge/restore/history/drive).
- Интеграции: Google Drive / Open Notebook / Telegram / AI (OpenRouter) — внешние зависимости с нетривиальным поведением.

## Notes
- `frontend/src/AppContent.tsx` больше не является primary hotspot: файл сведен к thin-root composition, а основной риск перенесён в feature-shell contracts.

## Medium
- Статусы и enum'ы: часть статусов свободный текст (`Deal.status`, `Policy.status`), часть фиксированная (Tasks/Document/Statement). Риск рассинхрона между backend и frontend.
- Soft delete и каскады (`Deal.delete`, `Policy.delete`, `Payment.delete`): поведенческие зависимости на уровне моделей.
- Финансы (`Payment`, `FinancialRecord`, `Statement`): правила удаления/привязки и вычислений распределены по слоям.

## Low
- `frontend/src/api/*`: мапперы и helpers могут дублировать преобразования, но изменения обычно локальные.
- `backend/apps/common/*`: много общих утилит, риск незаметных побочных эффектов при правках.
