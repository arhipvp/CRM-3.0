import { memo } from 'react';

import type { Policy, Statement } from '../../../types';
import { formatCurrencyRu, formatDateRu } from '../../../utils/formatting';
import { normalizeNumericAmount, parseNumericAmount } from '../../../utils/parseNumericAmount';
import { Button } from '../../common/Button';
import { TABLE_CELL_CLASS_SM, TABLE_ROW_CLASS } from '../../common/tableStyles';
import type { AmountDraft, IncomeExpenseRow } from './RecordsTable';

interface RecordsTableRowProps {
  row: IncomeExpenseRow;
  policy?: Policy;
  recordStatement?: Statement;
  attachStatement?: Statement;
  isAttachStatementPaid: boolean;
  isSelected: boolean;
  isSelectable: boolean;
  amountDraft?: AmountDraft;
  isSavingAmount?: boolean;
  amountError?: string;
  isRecordAmountEditable: boolean;
  editingPolicyRecordId?: string | null;
  normalizeText: (value?: string | null) => string;
  onToggleRecordSelection: (row: IncomeExpenseRow) => void;
  onOpenDeal: (dealId: string) => void;
  onDealSelect?: (dealId: string) => void;
  onRequestEditPolicy?: (row: IncomeExpenseRow) => Promise<void> | void;
  getPercentFromSaldo: (row: IncomeExpenseRow, absoluteAmount: number) => string;
  getAbsoluteSaldoBase: (row: IncomeExpenseRow) => number;
  onRecordAmountChange: (recordId: string, value: string) => void;
  onRecordAmountBlur: (row: IncomeExpenseRow) => Promise<void> | void;
  onCancelRecordAmountEdit?: (recordId: string) => void;
  onToggleRecordAmountMode: (row: IncomeExpenseRow) => void;
}

export const RecordsTableRow = memo(function RecordsTableRow({
  row,
  policy,
  recordStatement,
  attachStatement,
  isAttachStatementPaid,
  isSelected,
  isSelectable,
  amountDraft,
  isSavingAmount = false,
  amountError,
  isRecordAmountEditable,
  editingPolicyRecordId = null,
  normalizeText,
  onToggleRecordSelection,
  onOpenDeal,
  onDealSelect,
  onRequestEditPolicy,
  getPercentFromSaldo,
  getAbsoluteSaldoBase,
  onRecordAmountChange,
  onRecordAmountBlur,
  onCancelRecordAmountEdit,
  onToggleRecordAmountMode,
}: RecordsTableRowProps) {
  const payment = row.payment;
  const policyNumber =
    normalizeText(row.policyNumber) ||
    normalizeText(payment.policyNumber) ||
    normalizeText(policy?.number) ||
    '-';
  const policyType =
    normalizeText(row.policyInsuranceType) ||
    normalizeText(payment.policyInsuranceType) ||
    normalizeText(policy?.insuranceType) ||
    '-';
  const salesChannelLabel =
    normalizeText(row.salesChannelName) ||
    normalizeText(policy?.salesChannelName) ||
    normalizeText(policy?.salesChannel) ||
    '-';
  const dealClientName =
    normalizeText(row.dealClientName) || normalizeText(payment.dealClientName) || '-';
  const policyClientName =
    normalizeText(row.policyClientName) ||
    normalizeText(row.policyInsuredClientName) ||
    normalizeText(policy?.clientName) ||
    normalizeText(policy?.insuredClientName) ||
    dealClientName ||
    '-';
  const dealTitle = normalizeText(row.dealTitle) || normalizeText(payment.dealTitle) || '-';
  const paymentActualDate = row.paymentActualDate
    ? formatDateRu(row.paymentActualDate)
    : payment.actualDate
      ? formatDateRu(payment.actualDate)
      : null;
  const paymentScheduledDate = row.paymentScheduledDate
    ? formatDateRu(row.paymentScheduledDate)
    : payment.scheduledDate
      ? formatDateRu(payment.scheduledDate)
      : null;
  const rowPolicyId = row.policyId ?? payment.policyId ?? null;
  const dealId = row.dealId ?? payment.dealId;
  const canEditPolicy = Boolean(onRequestEditPolicy && rowPolicyId && policyNumber !== '-');
  const isOpeningPolicy = editingPolicyRecordId === row.recordId;
  const isPaymentPaid = Boolean(row.paymentActualDate ?? payment.actualDate);
  const recordAmount = row.recordAmount;
  const isIncome = row.recordKind === 'income';
  const recordClass = isIncome ? 'text-emerald-700' : 'text-rose-700';
  const recordTypeLabel = isIncome ? 'Доход' : 'Расход';
  const paymentBalanceLabel =
    row.paymentPaidBalance === undefined ? '—' : formatCurrencyRu(row.paymentPaidBalance);
  const paymentEntries = (row.paymentPaidEntries ?? [])
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const commentParts = [row.recordNote, row.recordDescription, row.recordSource]
    .map((value) => normalizeText(value?.toString().trim()))
    .filter(Boolean);
  const amountMode: AmountDraft['mode'] = amountDraft?.mode ?? 'rub';
  const amountValue =
    amountDraft?.value ??
    (amountMode === 'rub'
      ? Math.abs(recordAmount).toString()
      : getPercentFromSaldo(row, Math.abs(recordAmount)));
  const saldoBase = getAbsoluteSaldoBase(row);
  const parsedAmountValue = parseNumericAmount(amountValue);
  const percentPreviewAmount =
    amountMode === 'percent' && Number.isFinite(parsedAmountValue) && saldoBase > 0
      ? (saldoBase * parsedAmountValue) / 100
      : null;
  const isRecordLocked = Boolean(recordStatement?.paidAt);
  const statementNote = recordStatement
    ? recordStatement.paidAt
      ? `Ведомость от ${formatDateRu(recordStatement.paidAt)}: ${normalizeText(recordStatement.name)}`
      : `Ведомость: ${normalizeText(recordStatement.name)}`
    : null;

  return (
    <tr
      className={`${TABLE_ROW_CLASS} focus-within:border-sky-600 focus-within:bg-sky-200/90 focus-within:[&>td]:!border-y-sky-300 focus-within:[&>td]:!bg-sky-100`}
    >
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
            <Button
              type="button"
              onClick={() => onOpenDeal(dealId)}
              className="link-action text-[11px] font-semibold"
            >
              {dealTitle}
            </Button>
          ) : (
            <span>{dealTitle}</span>
          )}
        </div>
        <p className="mt-1 text-[11px] text-slate-500">
          Контакт по сделке: <span className="font-semibold text-slate-700">{dealClientName}</span>
        </p>
      </td>
      <td className={`${TABLE_CELL_CLASS_SM} min-w-0 text-slate-700`}>
        {canEditPolicy ? (
          <Button
            type="button"
            onClick={() => void onRequestEditPolicy?.(row)}
            disabled={isOpeningPolicy}
            className="link-action text-left disabled:cursor-wait disabled:opacity-60"
            title={isOpeningPolicy ? 'Открываем полис...' : 'Редактировать полис'}
            aria-label={`Редактировать полис ${policyNumber}`}
          >
            {policyNumber}
          </Button>
        ) : (
          <span>{policyNumber}</span>
        )}
      </td>
      <td
        lang="ru"
        className={`${TABLE_CELL_CLASS_SM} min-w-0 text-slate-700 hyphens-auto break-words`}
      >
        {policyType}
      </td>
      <td className={`${TABLE_CELL_CLASS_SM} min-w-0 text-slate-700 hyphens-auto break-words`}>
        {salesChannelLabel}
      </td>
      <td className={`${TABLE_CELL_CLASS_SM} min-w-0 text-right text-slate-700`}>
        <p className="text-sm font-semibold">{paymentScheduledDate || '—'}</p>
      </td>
      <td className={`${TABLE_CELL_CLASS_SM} min-w-0 text-right text-slate-700`}>
        <p className="text-sm font-semibold">{formatCurrencyRu(Number(payment.amount))}</p>
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
              return (
                <p key={`${row.payment.id}-${index}`}>
                  {entryAmount >= 0 ? 'Доход' : 'Расход'}{' '}
                  {Number.isFinite(entryAmount)
                    ? formatCurrencyRu(Math.abs(entryAmount))
                    : entry.amount}{' '}
                  · {formatDateRu(entry.date)}
                </p>
              );
            })}
          </div>
        ) : (
          <p className="mt-1 text-[11px] text-slate-500">Операций нет</p>
        )}
      </td>
      <td className={`${TABLE_CELL_CLASS_SM} min-w-0 text-slate-700`}>
        {commentParts[0] ? (
          <p className="text-sm font-semibold text-slate-900">{commentParts[0]}</p>
        ) : (
          <p className="text-sm font-semibold text-slate-400">—</p>
        )}
        <p className={`mt-1 text-[11px] font-semibold ${recordClass}`}>{recordTypeLabel}</p>
        {commentParts.length > 1 && (
          <p className="mt-1 text-[11px] text-slate-500">{commentParts.slice(1).join(' · ')}</p>
        )}
        {statementNote && <p className="mt-1 text-[11px] text-slate-500">{statementNote}</p>}
      </td>
      <td className={`${TABLE_CELL_CLASS_SM} w-[220px] min-w-[220px] text-right text-slate-700`}>
        <p className={`text-sm font-semibold ${recordClass}`}>
          {isIncome ? '+' : '-'}
          {formatCurrencyRu(Math.abs(recordAmount))}
        </p>
        <p className="mt-1 text-[11px] text-slate-500">{formatDateRu(row.recordDate)}</p>
        {isRecordAmountEditable && (
          <div className="mt-1 flex w-full items-start justify-end gap-2">
            <div className="relative w-full max-w-[160px]">
              <input
                type="number"
                step={amountMode === 'rub' ? '0.01' : '0.1'}
                value={amountValue}
                onChange={(event) => onRecordAmountChange(row.recordId, event.target.value)}
                onPaste={(event) => {
                  const normalized = normalizeNumericAmount(event.clipboardData.getData('text'));
                  if (normalized !== null) {
                    event.preventDefault();
                    onRecordAmountChange(row.recordId, normalized);
                  }
                }}
                onBlur={() => void onRecordAmountBlur(row)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancelRecordAmountEdit?.(row.recordId);
                  }
                }}
                disabled={isRecordLocked || isSavingAmount}
                aria-invalid={Boolean(amountError)}
                aria-describedby={amountError ? `record-amount-error-${row.recordId}` : undefined}
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-0.5 pr-7 text-[11px] text-slate-700 focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100 disabled:bg-slate-50"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-400">
                {amountMode === 'rub' ? '₽' : '%'}
              </span>
            </div>
            <Button
              type="button"
              onClick={() => onToggleRecordAmountMode(row)}
              disabled={isRecordLocked || (amountMode === 'rub' && saldoBase <= 0)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              title={
                amountMode === 'rub'
                  ? saldoBase > 0
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
            </Button>
          </div>
        )}
        {isSavingAmount && <p className="mt-1 text-[11px] text-sky-600">Сохраняем…</p>}
        {amountError && (
          <p
            id={`record-amount-error-${row.recordId}`}
            role="alert"
            className="mt-1 text-[11px] text-rose-600"
          >
            {amountError}
          </p>
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
});
