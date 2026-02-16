import type { RefObject } from 'react';

import type { Payment, Policy, Statement } from '../../../types';
import { formatCurrencyRu, formatDateRu } from '../../../utils/formatting';
import { BTN_SM_DANGER, BTN_SM_PRIMARY, BTN_SM_SECONDARY } from '../../common/buttonStyles';
import { DataTableShell } from '../../common/table/DataTableShell';
import { EmptyTableState } from '../../common/table/EmptyTableState';
import { TableHeadCell } from '../../common/TableHeadCell';
import { TABLE_CELL_CLASS_SM, TABLE_ROW_CLASS, TABLE_THEAD_CLASS } from '../../common/tableStyles';
import { PolicyNumberButton } from '../../policies/PolicyNumberButton';

export type AllRecordsSortKey = 'none' | 'payment' | 'saldo' | 'comment' | 'amount';
export type AmountDraft = { mode: 'rub' | 'percent'; value: string };
const SORT_LABEL_CLASS = 'text-[11px] font-semibold uppercase tracking-wide text-slate-900';
const SORT_BUTTON_BASE_CLASS =
  'flex w-full items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white';

export type IncomeExpenseRow = {
  key: string;
  payment: Payment;
  recordId: string;
  statementId?: string | null;
  recordAmount: number;
  paymentPaidBalance?: number;
  paymentPaidEntries?: Array<{ amount: string; date: string }>;
  recordDate?: string | null;
  recordDescription?: string;
  recordSource?: string;
  recordNote?: string;
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
  isAllRecordsLoading: boolean;
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
  onToggleAllRecordsSort: (key: AllRecordsSortKey) => void;
  getAllRecordsSortLabel: (key: AllRecordsSortKey) => string;
  getAllRecordsSortIndicator: (key: AllRecordsSortKey) => string;
  onToggleAmountSort: () => void;
  getAmountSortLabel: () => string;
  getAmountSortIndicator: () => string;
  getPercentFromSaldo: (row: IncomeExpenseRow, absoluteAmount: number) => string;
  getAbsoluteSaldoBase: (row: IncomeExpenseRow) => number;
  onRecordAmountChange: (recordId: string, value: string) => void;
  onRecordAmountBlur: (row: IncomeExpenseRow) => Promise<void> | void;
  onToggleRecordAmountMode: (row: IncomeExpenseRow) => void;
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
  isAllRecordsLoading,
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
  onToggleAllRecordsSort,
  getAllRecordsSortLabel,
  getAllRecordsSortIndicator,
  onToggleAmountSort,
  getAmountSortLabel,
  getAmountSortIndicator,
  getPercentFromSaldo,
  getAbsoluteSaldoBase,
  onRecordAmountChange,
  onRecordAmountBlur,
  onToggleRecordAmountMode,
}: RecordsTableProps) => (
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
          {viewMode === 'statements' && selectedStatement && !isSelectedStatementPaid && (
            <span className="ml-2 text-xs text-slate-500">
              Чтобы убрать запись: выделите строку и нажмите &quot;Убрать из ведомости&quot;.
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewMode === 'statements' ? (
            <button
              type="button"
              onClick={() => void onRemoveSelected()}
              className={BTN_SM_DANGER}
              disabled={
                !selectedRecordIds.length ||
                !canRemoveSelectedAction ||
                isSelectedStatementPaid ||
                !selectedStatement
              }
            >
              Убрать из ведомости
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onAttachSelected()}
              className={BTN_SM_PRIMARY}
              disabled={
                !selectedRecordIds.length ||
                !canAttachSelectedAction ||
                !attachStatement ||
                isAttachStatementPaid
              }
            >
              Добавить выбранные
            </button>
          )}
          {selectedRecordIds.length > 0 && (
            <button type="button" onClick={onResetSelection} className={BTN_SM_SECONDARY}>
              Сбросить выделение
            </button>
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
            <TableHeadCell padding="sm" className="w-[22%] min-w-0">
              Клиент / сделка
            </TableHeadCell>
            <TableHeadCell padding="sm" className="w-[12%] min-w-0">
              Номер полиса
            </TableHeadCell>
            <TableHeadCell padding="sm" className="w-[12%] min-w-0">
              Тип полиса
            </TableHeadCell>
            <TableHeadCell padding="sm" className="w-[9%] min-w-0">
              Канал продаж
            </TableHeadCell>
            <TableHeadCell padding="sm" className="w-[14%] min-w-0" align="right">
              {viewMode === 'all' ? (
                <button
                  type="button"
                  onClick={() => onToggleAllRecordsSort('payment')}
                  aria-label={`Сортировать по платежу, текущий порядок ${getAllRecordsSortLabel('payment')}`}
                  className={`${SORT_BUTTON_BASE_CLASS} justify-end`}
                >
                  <span className={SORT_LABEL_CLASS}>Платеж</span>
                  <span className={SORT_LABEL_CLASS}>{getAllRecordsSortIndicator('payment')}</span>
                </button>
              ) : (
                <span className={SORT_LABEL_CLASS}>Платеж</span>
              )}
            </TableHeadCell>
            <TableHeadCell padding="sm" className="w-[15%] min-w-0" align="right">
              {viewMode === 'all' ? (
                <button
                  type="button"
                  onClick={() => onToggleAllRecordsSort('saldo')}
                  aria-label={`Сортировать по сальдо, текущий порядок ${getAllRecordsSortLabel('saldo')}`}
                  className={`${SORT_BUTTON_BASE_CLASS} justify-end`}
                >
                  <span className={SORT_LABEL_CLASS}>Сальдо</span>
                  <span className={SORT_LABEL_CLASS}>{getAllRecordsSortIndicator('saldo')}</span>
                </button>
              ) : (
                <span className={SORT_LABEL_CLASS}>Сальдо</span>
              )}
            </TableHeadCell>
            <TableHeadCell padding="sm" className="w-[16%] min-w-0">
              {viewMode === 'all' ? (
                <button
                  type="button"
                  onClick={() => onToggleAllRecordsSort('comment')}
                  aria-label={`Сортировать по примечанию, текущий порядок ${getAllRecordsSortLabel('comment')}`}
                  className={`${SORT_BUTTON_BASE_CLASS} justify-start`}
                >
                  <span className={SORT_LABEL_CLASS}>Примечание</span>
                  <span className={SORT_LABEL_CLASS}>{getAllRecordsSortIndicator('comment')}</span>
                </button>
              ) : (
                <span className={SORT_LABEL_CLASS}>Примечание</span>
              )}
            </TableHeadCell>
            <TableHeadCell padding="sm" className="w-[220px]" align="right">
              {viewMode === 'all' ? (
                <button
                  type="button"
                  onClick={() => onToggleAllRecordsSort('amount')}
                  aria-label={`Сортировать по сумме, текущий порядок ${getAllRecordsSortLabel('amount')}`}
                  className={`${SORT_BUTTON_BASE_CLASS} justify-end`}
                >
                  <span className={SORT_LABEL_CLASS}>Сумма, ₽</span>
                  <span className={SORT_LABEL_CLASS}>{getAllRecordsSortIndicator('amount')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onToggleAmountSort}
                  aria-label={`Сортировать по сумме, текущий порядок ${getAmountSortLabel()}`}
                  className={`${SORT_BUTTON_BASE_CLASS} justify-end`}
                >
                  <span className={SORT_LABEL_CLASS}>Сумма, ₽</span>
                  <span className={SORT_LABEL_CLASS}>{getAmountSortIndicator()}</span>
                </button>
              )}
            </TableHeadCell>
          </tr>
        </thead>
        <tbody className="bg-white">
          {filteredRows.map((row) => {
            const payment = row.payment;
            const policy = payment.policyId ? policiesById.get(payment.policyId) : undefined;
            const policyNumber =
              normalizeText(payment.policyNumber) ||
              normalizeText(policiesById.get(payment.policyId ?? '')?.number) ||
              '-';
            const policyType =
              normalizeText(payment.policyInsuranceType) ||
              normalizeText(policiesById.get(payment.policyId ?? '')?.insuranceType) ||
              '-';
            const salesChannelLabel =
              normalizeText(policiesById.get(payment.policyId ?? '')?.salesChannelName) ||
              normalizeText(policiesById.get(payment.policyId ?? '')?.salesChannel) ||
              '-';
            const dealClientName = normalizeText(payment.dealClientName) || '-';
            const policyClientName =
              normalizeText(policy?.insuredClientName) ||
              normalizeText(policy?.clientName) ||
              dealClientName ||
              '-';
            const dealTitle = normalizeText(payment.dealTitle) || '-';
            const paymentActualDate = payment.actualDate ? formatDateRu(payment.actualDate) : null;
            const paymentScheduledDate = payment.scheduledDate
              ? formatDateRu(payment.scheduledDate)
              : null;
            const dealId = payment.dealId;
            const isPaymentPaid = Boolean(payment.actualDate);
            const recordAmount = row.recordAmount;
            const isIncome = recordAmount > 0;
            const recordClass = isIncome ? 'text-emerald-700' : 'text-rose-700';
            const recordDateLabel = formatDateRu(row.recordDate);
            const paymentBalance = row.paymentPaidBalance;
            const paymentBalanceLabel =
              paymentBalance === undefined ? '—' : formatCurrencyRu(paymentBalance);
            const paymentEntries = (row.paymentPaidEntries ?? []).slice().sort((a, b) => {
              const aTime = new Date(a.date).getTime();
              const bTime = new Date(b.date).getTime();
              return bTime - aTime;
            });
            const commentParts = [row.recordNote, row.recordDescription, row.recordSource]
              .map((value) => normalizeText(value?.toString().trim()))
              .filter(Boolean);
            const primaryComment = commentParts[0] ?? '';
            const secondaryComment =
              commentParts.length > 1 ? commentParts.slice(1).join(' · ') : '';
            const amountDraft = amountDrafts[row.recordId];
            const amountMode: AmountDraft['mode'] = amountDraft?.mode ?? 'rub';
            const amountValue =
              amountDraft?.value ??
              (amountMode === 'rub'
                ? Math.abs(recordAmount).toString()
                : getPercentFromSaldo(row, Math.abs(recordAmount)));
            const saldoBase = getAbsoluteSaldoBase(row);
            const isPercentModeAvailable = saldoBase > 0;
            const amountSuffix = amountMode === 'rub' ? '₽' : '%';
            const percentPreviewAmount =
              amountMode === 'percent' && Number.isFinite(Number(amountValue)) && saldoBase > 0
                ? (saldoBase * Number(amountValue)) / 100
                : null;
            const recordStatement = row.statementId
              ? statementsById.get(row.statementId)
              : undefined;
            const isRecordLocked = Boolean(recordStatement?.paidAt);
            const statementNote = recordStatement
              ? recordStatement.paidAt
                ? `Ведомость от ${formatDateRu(recordStatement.paidAt)}: ${normalizeText(
                    recordStatement.name,
                  )}`
                : `Ведомость: ${normalizeText(recordStatement.name)}`
              : null;
            const isSelectable = attachStatement ? canAttachRow(row) : false;
            const isSelected = selectedRecordIds.includes(row.recordId);

            return (
              <tr key={row.key} className={TABLE_ROW_CLASS}>
                <td className="border border-slate-200 px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleRecordSelection(row)}
                    disabled={!isSelectable || isAttachStatementPaid}
                    className="check"
                    title={
                      !attachStatement
                        ? 'Выберите ведомость для добавления записей'
                        : !isSelectable
                          ? 'Запись нельзя добавить в выбранную ведомость'
                          : undefined
                    }
                  />
                </td>
                <td className={`${TABLE_CELL_CLASS_SM} min-w-0`}>
                  <p className="text-sm font-semibold text-slate-900">{policyClientName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    {dealId && onDealSelect ? (
                      <button
                        type="button"
                        onClick={() => onOpenDeal(dealId)}
                        className="link-action text-[11px] font-semibold"
                      >
                        {dealTitle}
                      </button>
                    ) : (
                      <span>{dealTitle}</span>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Контакт по сделке:{' '}
                    <span className="font-semibold text-slate-700">{dealClientName}</span>
                  </p>
                </td>
                <td className={`${TABLE_CELL_CLASS_SM} min-w-0 text-slate-700`}>
                  <PolicyNumberButton
                    value={policyNumber === '-' ? '' : policyNumber}
                    placeholder="-"
                    className="link-action text-left"
                  />
                </td>
                <td
                  lang="ru"
                  className={`${TABLE_CELL_CLASS_SM} min-w-0 text-slate-700 hyphens-auto break-words`}
                >
                  {policyType}
                </td>
                <td
                  className={`${TABLE_CELL_CLASS_SM} min-w-0 text-slate-700 hyphens-auto break-words`}
                >
                  {salesChannelLabel}
                </td>
                <td className={`${TABLE_CELL_CLASS_SM} min-w-0 text-right text-slate-700`}>
                  <p className="text-sm font-semibold">
                    {formatCurrencyRu(Number(payment.amount))}
                  </p>
                  {isPaymentPaid ? (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                      Оплачен{paymentActualDate ? `: ${paymentActualDate}` : ''}
                    </p>
                  ) : (
                    <p className="mt-1 text-[11px] font-semibold text-rose-700">
                      Не оплачен{paymentScheduledDate ? ` (план: ${paymentScheduledDate})` : ''}
                    </p>
                  )}
                </td>
                <td className={`${TABLE_CELL_CLASS_SM} min-w-0 text-right text-slate-700`}>
                  <p className="text-sm font-semibold">{paymentBalanceLabel}</p>
                  {paymentEntries.length ? (
                    <div className="mt-1 space-y-1 text-[11px] text-slate-500">
                      {paymentEntries.map((entry, index) => {
                        const entryAmount = Number(entry.amount);
                        const entryLabel = Number.isFinite(entryAmount)
                          ? formatCurrencyRu(Math.abs(entryAmount))
                          : entry.amount;
                        const entryDate = formatDateRu(entry.date);
                        const entryType = entryAmount >= 0 ? 'Доход' : 'Расход';
                        return (
                          <p key={`${row.payment.id}-${index}`}>
                            {entryType} {entryLabel} · {entryDate}
                          </p>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-1 text-[11px] text-slate-500">Операций нет</p>
                  )}
                </td>
                <td className={`${TABLE_CELL_CLASS_SM} min-w-0 text-slate-700`}>
                  {primaryComment ? (
                    <p className="text-sm font-semibold text-slate-900">{primaryComment}</p>
                  ) : (
                    <p className="text-sm font-semibold text-slate-400">—</p>
                  )}
                  {secondaryComment && (
                    <p className="mt-1 text-[11px] text-slate-500">{secondaryComment}</p>
                  )}
                  {statementNote && (
                    <p className="mt-1 text-[11px] text-slate-500">{statementNote}</p>
                  )}
                </td>
                <td
                  className={`${TABLE_CELL_CLASS_SM} w-[220px] min-w-[220px] text-right text-slate-700`}
                >
                  <p className={`text-sm font-semibold ${recordClass}`}>
                    {isIncome ? '+' : '-'}
                    {formatCurrencyRu(Math.abs(recordAmount))}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500">{recordDateLabel}</p>
                  {isRecordAmountEditable && (
                    <div className="mt-1 flex w-full items-start justify-end gap-2">
                      <div className="relative w-full max-w-[160px]">
                        <input
                          type="number"
                          step={amountMode === 'rub' ? '0.01' : '0.1'}
                          value={amountValue}
                          onChange={(event) =>
                            onRecordAmountChange(row.recordId, event.target.value)
                          }
                          onBlur={() => void onRecordAmountBlur(row)}
                          disabled={isRecordLocked}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 pr-7 text-[11px] text-slate-700 focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100 disabled:bg-slate-50"
                        />
                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                          {amountSuffix}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => onToggleRecordAmountMode(row)}
                        disabled={
                          isRecordLocked || (amountMode === 'rub' && !isPercentModeAvailable)
                        }
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                        title={
                          amountMode === 'rub'
                            ? isPercentModeAvailable
                              ? 'Ввести в процентах от Сальдо'
                              : 'Нельзя посчитать процент: Сальдо равно 0'
                            : 'Ввести сумму в рублях'
                        }
                        aria-label={
                          amountMode === 'rub'
                            ? 'Переключить ввод суммы на проценты от сальдо'
                            : 'Переключить ввод суммы на рубли'
                        }
                      >
                        {amountMode === 'rub' ? '%' : '₽'}
                      </button>
                    </div>
                  )}
                  {isRecordAmountEditable && amountMode === 'percent' && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      {percentPreviewAmount === null
                        ? `Процент от Сальдо: ${paymentBalanceLabel}`
                        : `≈ ${formatCurrencyRu(percentPreviewAmount)} от ${paymentBalanceLabel}`}
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
          {!filteredRows.length && (
            <EmptyTableState colSpan={9}>
              {viewMode === 'all' && isAllRecordsLoading
                ? 'Загрузка записей...'
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
