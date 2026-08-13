# Component Reuse Audit

## Обновление дизайн-системы (2026-08-13)

- Семантические токены цвета, геометрии, отступов, фокуса и теней собраны в `src/index.css`.
- Добавлены единые `PageShell`, `PageHeader`, `Toolbar` и типизированный `Tabs`.
- Все основные маршруты получили видимый заголовок первого уровня и общий page shell.
- Базовые кнопки, поля, панели, таблицы, модальные окна, уведомления и пагинация переведены на компактный desktop-стандарт.
- Compatibility-файлы `buttonStyles.ts` и `uiClassNames.ts` удалены; production-кнопки переведены на `Button` и `IconButton`, а возврат старых импортов запрещён ESLint.
- Добавлены `KpiCard`, `LoadingState`, `Spinner`, `SortButton`, `CheckboxField`, расширенные semantic tones и dev-only UI Catalog.
- Добавлены committed visual baselines Playwright для двух desktop-разрешений.
- Правила и токены описаны в `docs/design-system.md`.

## Целевой стандарт

1. Формы:

- `FormField` для заголовка и обертки поля.
- `FormError` для единой зоны ошибок.
- `FormActions` для submit/cancel состояния.
- `FormSection` для блоков формы с `space-y-4`.

2. Модалки:

- `FormModal` как единая обертка над `Modal` для форм.

3. Confirm-потоки:

- `useConfirm` + `ConfirmDialog` вместо прямого `window.confirm`.
- `src/constants/confirmTexts.ts` как единый словарь заголовков/текстов confirm-диалогов.

4. Таблицы:

- `DataTableShell` как общий контейнер таблицы.
- `EmptyTableState` как единый пустой state в `<tbody>`.
- `DriveFilesTable` как общий примитив для file-like таблиц.

5. Кнопки действий:

- `Button`/`IconButton` и типизированные варианты `primary/secondary/danger/quiet/success/outline/link/linkDanger`; нативные кнопки остаются только внутри общих примитивов.

6. Семантическое оформление:

- Статусы задаются `tone`; повторяемая геометрия хранится в общих компонентах и semantic CSS-классах.

7. Статус и ошибки:

- `InlineAlert` как единый примитив для inline-ошибок/успеха вместо ручных `app-alert`-блоков.

## Что переведено

### Формы

- `src/components/forms/AddTaskForm.tsx`
- `src/components/forms/AddPaymentForm.tsx`
- `src/components/forms/AddFinancialRecordForm.tsx`
- `src/components/forms/ClientForm.tsx`
- `src/components/forms/AddQuoteForm.tsx`
- `src/components/forms/DealForm.tsx`
- `src/components/forms/AddPolicyForm.tsx` (декомпозиция шагов)

### Модалки

- `src/components/payments/PaymentModal.tsx`
- `src/components/financialRecords/FinancialRecordModal.tsx`
- `src/components/app/AppModals.tsx`

### Таблицы

- `src/components/views/ClientsView.tsx`
- `src/components/views/PaymentsView.tsx`
- `src/components/tasks/TaskTable.tsx`
- `src/components/views/PoliciesView.tsx`

### Confirm

- `src/components/tasks/TaskTable.tsx`
- `src/components/views/KnowledgeDocumentsView.tsx`
- `src/components/views/CommissionsView.tsx`
- `src/components/views/dealsView/hooks/useDealDriveFiles.ts`
- `src/components/views/dealsView/DealDetailsPanel.tsx`
- `src/AppContent.tsx`

## Новые примитивы

- `src/components/common/forms/FormField.tsx`
- `src/components/common/forms/FormError.tsx`
- `src/components/common/forms/FormSection.tsx`
- `src/components/common/forms/FormActions.tsx`
- `src/components/common/modal/FormModal.tsx`
- `src/components/common/ConfirmDialog.tsx`
- `src/hooks/useConfirm.ts`
- `src/constants/confirmTexts.ts`
- `src/components/common/KpiCard.tsx`
- `src/components/common/LoadingState.tsx`
- `src/components/common/forms/CheckboxField.tsx`
- `src/components/common/table/DataTableShell.tsx`
- `src/components/common/table/EmptyTableState.tsx`
- `src/components/common/table/DriveFilesTable.tsx`
- `src/components/common/modal/PromptDialog.tsx`
- `src/components/common/InlineAlert.tsx`
- `src/components/common/forms/formClassNames.ts`

## Дополнительная декомпозиция P1

- `src/components/forms/addPolicy/components/PolicyBasicsStep.tsx`
- `src/components/forms/addPolicy/components/PolicyPaymentsStep.tsx`
- `src/components/forms/addPolicy/components/PolicyFinanceStep.tsx`
- `src/components/views/commissions/CreateStatementModal.tsx`
- `src/components/views/commissions/EditStatementModal.tsx`
- `src/components/views/commissions/DeleteStatementModal.tsx`
- `src/components/views/commissions/StatementFilesTab.tsx`
- `src/components/views/commissions/RecordsTable.tsx`
- `src/components/views/commissions/AllRecordsPanel.tsx`
- `src/components/views/commissions/hooks/useAllRecordsController.ts`
- `src/components/views/commissions/hooks/useStatementRecordsSelection.ts`
- `src/components/views/commissions/hooks/useRecordAmountEditing.ts`
- `src/components/views/commissions/hooks/useStatementDriveManager.ts`
- `src/components/views/commissions/hooks/useStatementsManager.ts`
- `src/components/views/commissions/hooks/useCommissionsRows.ts`
- `src/components/views/commissions/hooks/useCommissionsViewModel.ts`

## Декомпозиция orchestration-экранов

- `AppContent`, dashboard, настройки, база знаний и форма полиса разделены на entry-компоненты, controller-hooks, presentation-секции и pure helpers.
- Сделка, файлы, полисы сделки и список сделок используют отдельные view-model/controller-слои; внешние props сохранены.
- Списки полисов и комиссий разделены на фильтры, таблицы, строки, диалоги и controller-hooks.
- Целевые entry-компоненты укладываются в 500 значимых строк, leaf TSX — в 700; пороги закреплены ESLint `max-lines` как предупреждения.
- Dashboard calculations покрывают диапазоны дат, календарь, серии графиков и финансовую матрицу. Подготовка payload формы полиса остаётся в типизированном controller-hook и проверяется view-тестами формы.

## Обновления (2026-02-16)

- Убран `window.prompt` из закрытия сделки; теперь используется `PromptDialog`.
- File-like таблицы сведены к общему `DriveFilesTable`:
  - `src/components/DriveFilesModal.tsx`
  - `src/components/views/commissions/StatementFilesTab.tsx`
  - `src/components/views/dealsView/tabs/FilesTab.tsx`
- Табличный shell дополнительно выровнен в:
  - `src/components/views/dealsView/DealsList.tsx`
  - `src/components/views/dealsView/tabs/QuotesTab.tsx`
  - `src/components/views/commissions/RecordsTable.tsx`
- Кнопочные варианты перенесены в типизированный API `Button`.
- Добавлены form class helpers:
  - `FORM_INPUT_DISABLED`, `FORM_TEXTAREA_DISABLED`.
- Статус/ошибки в ключевых экранах переведены на `InlineAlert`.
- Чат/история из `DealDetailsPanel` частично вынесены в `hooks/useDealCommunication.ts`.
