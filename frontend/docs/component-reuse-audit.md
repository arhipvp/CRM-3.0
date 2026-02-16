# Component Reuse Audit

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
- `src/components/common/table/DataTableShell.tsx`
- `src/components/common/table/EmptyTableState.tsx`

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
