import { useMemo } from 'react';
import type { RefObject } from 'react';

import type { Payment, Policy, Statement } from '../../../types';
import { normalizeNumericAmount } from '../../../utils/parseNumericAmount';
import { Button } from '../../common/Button';
import { DataTableShell } from '../../common/table/DataTableShell';
import { EmptyTableState } from '../../common/table/EmptyTableState';
import { TableHeadCell } from '../../common/TableHeadCell';
import { TABLE_THEAD_CLASS } from '../../common/tableStyles';
import { RecordsTableRow } from './RecordsTableRow';

export type AllRecordsSortKey = 'none' | 'payment' | 'paymentDate' | 'saldo' | 'comment' | 'amount';
export type AmountDraft = { mode: 'rub' | 'percent'; value: string };
export type StatementAmountDraft = AmountDraft;
export type IncomeExpenseKind = 'income' | 'expense';
const SORT_LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-wide text-slate-900';
const SORT_BUTTON_BASE_CLASS =
  'flex w-full items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export type IncomeExpenseRow = {
  key: string;
  payment: Payment;
  recordId: string;
  statementId?: string | null;
  recordKind: IncomeExpenseKind;
  recordAmount: number;
  paymentPaidBalance?: number;
  paymentPaidEntries?: Array<{ amount: string; date: string }>;
  recordDate?: string | null;
  recordDescription?: string;
  recordSource?: string;
  recordNote?: string;
  dealId?: string | null;
  dealTitle?: string | null;
  dealClientName?: string | null;
  policyId?: string | null;
  policyNumber?: string | null;
  policyInsuranceType?: string | null;
  policyClientName?: string | null;
  policyInsuredClientName?: string | null;
  salesChannelName?: string | null;
  paymentActualDate?: string | null;
  paymentScheduledDate?: string | null;
};

interface RecordsTableProps {
  attachStatement?: Statement;
  isAttachStatementPaid: boolean;
  selectedStatement?: Statement;
  isSelectedStatementPaid: boolean;
  viewMode: 'all' | 'statements';
  selectedRecordIds: string[];
  selectableRecordIds: string[];
  allSelectableSelected: boolean;
  selectAllRef: RefObject<HTMLInputElement | null>;
  filteredRows: IncomeExpenseRow[];
  policiesById: Map<string, Policy>;
  statementsById: Map<string, Statement>;
  amountDrafts: Record<string, AmountDraft>;
  savingRecordIds?: Set<string>;
  recordAmountErrors?: Record<string, string>;
  statementAmountDraft: StatementAmountDraft;
  isApplyingStatementAmount: boolean;
  isAttaching?: boolean;
  isAllRecordsLoading: boolean;
  isStatementRecordsLoading: boolean;
  isRecordAmountEditable: boolean;
  canAttachSelectedAction: boolean;
  canRemoveSelectedAction: boolean;
  normalizeText: (value?: string | null) => string;
  canAttachRow: (row: IncomeExpenseRow) => boolean;
  onAttachSelected: () => Promise<void> | void;
  onRemoveSelected: () => Promise<void> | void;
  onResetSelection: () => void;
  onToggleSelectAll: () => void;
  onToggleRecordSelection: (row: IncomeExpenseRow) => void;
  onOpenDeal: (dealId: string) => void;
  onDealSelect?: (dealId: string) => void;
  onRequestEditPolicy?: (row: IncomeExpenseRow) => Promise<void> | void;
  editingPolicyRecordId?: string | null;
  onToggleAllRecordsSort: (key: AllRecordsSortKey) => void;
  getAllRecordsSortLabel: (key: AllRecordsSortKey) => string;
  getAllRecordsSortIndicator: (key: AllRecordsSortKey) => string;
  onToggleAmountSort: () => void;
  getAmountSortLabel: () => string;
  getAmountSortIndicator: () => string;
  onToggleCommentSort: () => void;
  getCommentSortLabel: () => string;
  getCommentSortIndicator: () => string;
  getPercentFromSaldo: (row: IncomeExpenseRow, absoluteAmount: number) => string;
  getAbsoluteSaldoBase: (row: IncomeExpenseRow) => number;
  onRecordAmountChange: (recordId: string, value: string) => void;
  onRecordAmountBlur: (row: IncomeExpenseRow) => Promise<void> | void;
  onCancelRecordAmountEdit?: (recordId: string) => void;
  onToggleRecordAmountMode: (row: IncomeExpenseRow) => void;
  onStatementAmountChange: (value: string) => void;
  onToggleStatementAmountMode: () => void;
  onApplyStatementAmount: () => Promise<void> | void;
}

export const RecordsTable = ({
  attachStatement,
  isAttachStatementPaid,
  selectedStatement,
  isSelectedStatementPaid,
  viewMode,
  selectedRecordIds,
  selectableRecordIds,
  allSelectableSelected,
  selectAllRef,
  filteredRows,
  policiesById,
  statementsById,
  amountDrafts,
  savingRecordIds = new Set(),
  recordAmountErrors = {},
  statementAmountDraft,
  isApplyingStatementAmount,
  isAttaching = false,
  isAllRecordsLoading,
  isStatementRecordsLoading,
  isRecordAmountEditable,
  canAttachSelectedAction,
  canRemoveSelectedAction,
  normalizeText,
  canAttachRow,
  onAttachSelected,
  onRemoveSelected,
  onResetSelection,
  onToggleSelectAll,
  onToggleRecordSelection,
  onOpenDeal,
  onDealSelect,
  onRequestEditPolicy,
  editingPolicyRecordId = null,
  onToggleAllRecordsSort,
  getAllRecordsSortLabel,
  getAllRecordsSortIndicator,
  onToggleAmountSort,
  getAmountSortLabel,
  getAmountSortIndicator,
  onToggleCommentSort,
  getCommentSortLabel,
  getCommentSortIndicator,
  getPercentFromSaldo,
  getAbsoluteSaldoBase,
  onRecordAmountChange,
  onRecordAmountBlur,
  onCancelRecordAmountEdit,
  onToggleRecordAmountMode,
  onStatementAmountChange,
  onToggleStatementAmountMode,
  onApplyStatementAmount,
}: RecordsTableProps) => {
  const editableStatementRows =
    viewMode === 'statements'
      ? filteredRows.filter((row) => !statementsById.get(row.statementId ?? '')?.paidAt)
      : [];
  const hasStatementPercentEligibleRows = editableStatementRows.some(
    (row) => getAbsoluteSaldoBase(row) > 0,
  );
  const isStatementAmountControlDisabled =
    !isRecordAmountEditable ||
    isSelectedStatementPaid ||
    !selectedStatement ||
    editableStatementRows.length === 0;
  const statementAmountSuffix = statementAmountDraft.mode === 'rub' ? '₽' : '%';
  const statementAmountModeToggleLabel =
    statementAmountDraft.mode === 'rub'
      ? 'Переключить ввод суммы на проценты'
      : 'Переключить ввод суммы на рубли';
  const statementAmountModeToggleTitle =
    statementAmountDraft.mode === 'rub'
      ? 'Ввести значение в процентах от сальдо'
      : 'Ввести значение в рублях';
  const selectedRecordIdSet = useMemo(() => new Set(selectedRecordIds), [selectedRecordIds]);

  return (
    <div className="rounded-2xl border-2 border-slate-300 bg-white shadow-sm">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm text-slate-700">
            {attachStatement ? (
              <>
                Выбрано: <span className="font-semibold">{selectedRecordIds.length}</span>
                {viewMode === 'all' ? ` · Ведомость: ${normalizeText(attachStatement.name)}` : ''}
              </>
            ) : (
              <span className="text-slate-500">Выберите ведомость, чтобы добавлять записи.</span>
            )}
            {viewMode === 'statements' &&
              selectedStatement &&
              !isSelectedStatementPaid &&
              selectedRecordIds.length > 0 && (
                <span className="ml-2 text-xs text-slate-500">
                  Чтобы убрать запись: выделите строку и нажмите &quot;Убрать из ведомости&quot;.
                </span>
              )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'statements' ? (
              selectedRecordIds.length > 0 && (
                <Button
                  type="button"
                  onClick={() => void onRemoveSelected()}
                  variant="danger"
                  size="sm"
                  disabled={
                    !selectedRecordIds.length ||
                    !canRemoveSelectedAction ||
                    isSelectedStatementPaid ||
                    !selectedStatement
                  }
                >
                  Убрать из ведомости
                </Button>
              )
            ) : (
              <Button
                type="button"
                onClick={() => void onAttachSelected()}
                variant="primary"
                size="sm"
                disabled={
                  !selectedRecordIds.length ||
                  !canAttachSelectedAction ||
                  !attachStatement ||
                  isAttachStatementPaid ||
                  isAttaching
                }
              >
                {isAttaching ? 'Добавляем...' : 'Добавить выбранные'}
              </Button>
            )}
            {selectedRecordIds.length > 0 && (
              <Button type="button" onClick={onResetSelection} variant="secondary" size="sm">
                Сбросить выделение
              </Button>
            )}
          </div>
        </div>
      </div>
      <DataTableShell className="rounded-none border-0 shadow-none">
        <table
          className="deals-table w-full table-fixed border-collapse text-left text-sm"
          aria-label="Доходы и расходы"
        >
          <thead className={TABLE_THEAD_CLASS}>
            <tr>
              <TableHeadCell padding="sm" align="center" className="w-10">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelectableSelected}
                  onChange={onToggleSelectAll}
                  disabled={
                    !attachStatement || isAttachStatementPaid || selectableRecordIds.length === 0
                  }
                  className="check"
                  aria-label="Выбрать все видимые записи"
                  title={
                    !attachStatement
                      ? 'Выберите ведомость для добавления записей'
                      : isAttachStatementPaid
                        ? 'Выплаченная ведомость недоступна для изменений'
                        : undefined
                  }
                />
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[20%] min-w-0">
                Клиент / сделка
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[11%] min-w-0">
                Номер полиса
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[11%] min-w-0">
                Тип полиса
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[9%] min-w-0">
                Канал продаж
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[10%] min-w-0" align="right">
                {viewMode === 'all' ? (
                  <Button
                    type="button"
                    onClick={() => onToggleAllRecordsSort('paymentDate')}
                    aria-label={`Сортировать по дате платежа, текущий порядок ${getAllRecordsSortLabel('paymentDate')}`}
                    className={`${SORT_BUTTON_BASE_CLASS} justify-end`}
                  >
                    <span className={SORT_LABEL_CLASS}>Дата платежа</span>
                    <span className={SORT_LABEL_CLASS}>
                      {getAllRecordsSortIndicator('paymentDate')}
                    </span>
                  </Button>
                ) : (
                  <span className={SORT_LABEL_CLASS}>Дата платежа</span>
                )}
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[12%] min-w-0" align="right">
                {viewMode === 'all' ? (
                  <Button
                    type="button"
                    onClick={() => onToggleAllRecordsSort('payment')}
                    aria-label={`Сортировать по платежу, текущий порядок ${getAllRecordsSortLabel('payment')}`}
                    className={`${SORT_BUTTON_BASE_CLASS} justify-end`}
                  >
                    <span className={SORT_LABEL_CLASS}>Платеж</span>
                    <span className={SORT_LABEL_CLASS}>
                      {getAllRecordsSortIndicator('payment')}
                    </span>
                  </Button>
                ) : (
                  <span className={SORT_LABEL_CLASS}>Платеж</span>
                )}
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[13%] min-w-0" align="right">
                {viewMode === 'all' ? (
                  <Button
                    type="button"
                    onClick={() => onToggleAllRecordsSort('saldo')}
                    aria-label={`Сортировать по сальдо, текущий порядок ${getAllRecordsSortLabel('saldo')}`}
                    className={`${SORT_BUTTON_BASE_CLASS} justify-end`}
                  >
                    <span className={SORT_LABEL_CLASS}>Сальдо</span>
                    <span className={SORT_LABEL_CLASS}>{getAllRecordsSortIndicator('saldo')}</span>
                  </Button>
                ) : (
                  <span className={SORT_LABEL_CLASS}>Сальдо</span>
                )}
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[15%] min-w-0">
                {viewMode === 'all' ? (
                  <Button
                    type="button"
                    onClick={() => onToggleAllRecordsSort('comment')}
                    aria-label={`Сортировать по примечанию, текущий порядок ${getAllRecordsSortLabel('comment')}`}
                    className={`${SORT_BUTTON_BASE_CLASS} justify-start`}
                  >
                    <span className={SORT_LABEL_CLASS}>Примечание</span>
                    <span className={SORT_LABEL_CLASS}>
                      {getAllRecordsSortIndicator('comment')}
                    </span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={onToggleCommentSort}
                    aria-label={`Сортировать по примечанию, текущий порядок ${getCommentSortLabel()}`}
                    className={`${SORT_BUTTON_BASE_CLASS} justify-start`}
                  >
                    <span className={SORT_LABEL_CLASS}>Примечание</span>
                    <span className={SORT_LABEL_CLASS}>{getCommentSortIndicator()}</span>
                  </Button>
                )}
              </TableHeadCell>
              <TableHeadCell padding="sm" className="w-[220px]" align="right">
                <div className="flex flex-col items-end gap-2">
                  {viewMode === 'all' ? (
                    <Button
                      type="button"
                      onClick={() => onToggleAllRecordsSort('amount')}
                      aria-label={`Сортировать по сумме, текущий порядок ${getAllRecordsSortLabel('amount')}`}
                      className={`${SORT_BUTTON_BASE_CLASS} justify-end`}
                    >
                      <span className={SORT_LABEL_CLASS}>Сумма, ₽</span>
                      <span className={SORT_LABEL_CLASS}>
                        {getAllRecordsSortIndicator('amount')}
                      </span>
                    </Button>
                  ) : (
                    <>
                      <Button
                        type="button"
                        onClick={onToggleAmountSort}
                        aria-label={`Сортировать по сумме, текущий порядок ${getAmountSortLabel()}`}
                        className={`${SORT_BUTTON_BASE_CLASS} justify-end`}
                      >
                        <span className={SORT_LABEL_CLASS}>Сумма, ₽</span>
                        <span className={SORT_LABEL_CLASS}>{getAmountSortIndicator()}</span>
                      </Button>
                      {isRecordAmountEditable && (
                        <div className="flex w-full flex-col items-end gap-2 normal-case tracking-normal">
                          <div className="flex w-full items-start justify-end gap-2">
                            <div className="relative w-full max-w-[160px]">
                              <input
                                type="number"
                                step={statementAmountDraft.mode === 'rub' ? '0.01' : '0.1'}
                                value={statementAmountDraft.value}
                                onChange={(event) => onStatementAmountChange(event.target.value)}
                                onPaste={(event) => {
                                  const normalized = normalizeNumericAmount(
                                    event.clipboardData.getData('text'),
                                  );
                                  if (normalized !== null) {
                                    event.preventDefault();
                                    onStatementAmountChange(normalized);
                                  }
                                }}
                                disabled={
                                  isStatementAmountControlDisabled || isApplyingStatementAmount
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 pr-7 text-[11px] normal-case text-slate-700 focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100 disabled:bg-slate-50"
                                aria-label="Общая сумма для всей ведомости"
                              />
                              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] normal-case text-slate-400">
                                {statementAmountSuffix}
                              </span>
                            </div>
                            <Button
                              type="button"
                              onClick={onToggleStatementAmountMode}
                              disabled={
                                isStatementAmountControlDisabled ||
                                isApplyingStatementAmount ||
                                (statementAmountDraft.mode === 'rub' &&
                                  !hasStatementPercentEligibleRows)
                              }
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold normal-case text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                              title={
                                statementAmountDraft.mode === 'rub' &&
                                !hasStatementPercentEligibleRows
                                  ? 'Нельзя включить проценты: у записей нет сальдо'
                                  : statementAmountModeToggleTitle
                              }
                              aria-label={statementAmountModeToggleLabel}
                            >
                              {statementAmountDraft.mode === 'rub' ? '%' : '₽'}
                            </Button>
                          </div>
                          <Button
                            type="button"
                            onClick={() => void onApplyStatementAmount()}
                            disabled={
                              isStatementAmountControlDisabled ||
                              isApplyingStatementAmount ||
                              !statementAmountDraft.value.trim()
                            }
                            className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-semibold normal-case text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isApplyingStatementAmount
                              ? 'Применяем...'
                              : 'Применить ко всей ведомости'}
                          </Button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </TableHeadCell>
            </tr>
          </thead>
          <tbody className="bg-white">
            {filteredRows.map((row) => {
              const rowPolicyId = row.policyId ?? row.payment.policyId ?? null;
              const policy = rowPolicyId ? policiesById.get(rowPolicyId) : undefined;
              const recordStatement = row.statementId
                ? statementsById.get(row.statementId)
                : undefined;
              const isSelectable = attachStatement ? canAttachRow(row) : false;

              return (
                <RecordsTableRow
                  key={row.key}
                  row={row}
                  policy={policy}
                  recordStatement={recordStatement}
                  attachStatement={attachStatement}
                  isAttachStatementPaid={isAttachStatementPaid}
                  isSelected={selectedRecordIdSet.has(row.recordId)}
                  isSelectable={isSelectable}
                  amountDraft={amountDrafts[row.recordId]}
                  isSavingAmount={savingRecordIds.has(row.recordId)}
                  amountError={recordAmountErrors[row.recordId]}
                  isRecordAmountEditable={isRecordAmountEditable}
                  editingPolicyRecordId={editingPolicyRecordId}
                  normalizeText={normalizeText}
                  onToggleRecordSelection={onToggleRecordSelection}
                  onOpenDeal={onOpenDeal}
                  onDealSelect={onDealSelect}
                  onRequestEditPolicy={onRequestEditPolicy}
                  getPercentFromSaldo={getPercentFromSaldo}
                  getAbsoluteSaldoBase={getAbsoluteSaldoBase}
                  onRecordAmountChange={onRecordAmountChange}
                  onRecordAmountBlur={onRecordAmountBlur}
                  onCancelRecordAmountEdit={onCancelRecordAmountEdit}
                  onToggleRecordAmountMode={onToggleRecordAmountMode}
                />
              );
            })}
            {!filteredRows.length && (
              <EmptyTableState colSpan={10}>
                {viewMode === 'all' && isAllRecordsLoading
                  ? 'Загрузка записей...'
                  : viewMode === 'statements' && isStatementRecordsLoading
                    ? 'Загрузка записей ведомости...'
                    : viewMode === 'statements' && selectedStatement
                      ? 'Записей в ведомости пока нет'
                      : 'Записей пока нет'}
              </EmptyTableState>
            )}
          </tbody>
        </table>
      </DataTableShell>
    </div>
  );
};
