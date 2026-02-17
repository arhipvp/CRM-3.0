import React from 'react';
import type { FinancialRecord, Payment } from '../../types';
import { formatCurrency, formatDate } from '../views/dealsView/helpers';
import { POLICY_TEXT } from './text';
import { NESTED_TABLE_CELL_CLASS_COMPACT, NESTED_TABLE_ROW_CLASS } from '../common/tableStyles';

interface PaymentCardProps {
  payment: Payment;
  onEditPayment?: (paymentId: string) => void;
  onDeletePayment?: (paymentId: string) => Promise<void>;
  onRequestAddRecord: (paymentId: string, recordType: 'income' | 'expense') => void;
  onEditFinancialRecord: (recordId: string) => void;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  recordsExpandedOverride?: boolean;
  variant?: 'default' | 'table' | 'table-row';
  hideRowActions?: boolean;
}

const RECORD_TITLES: Record<'income' | 'expense', string> = {
  income: 'Доходы',
  expense: 'Расходы',
};

const RECORD_TYPE_TONE: Record<'income' | 'expense', string> = {
  income: 'text-emerald-700',
  expense: 'text-rose-700',
};

const resolveRecordGroups = (payment: Payment) => {
  const records = (payment.financialRecords ?? []).filter((record) => !record.deletedAt);
  return {
    incomes: records.filter((record) => record.recordType === 'Доход'),
    expenses: records.filter((record) => record.recordType === 'Расход'),
  };
};

const getRecordsAmount = (records: FinancialRecord[]) =>
  records.reduce((total, record) => total + Math.abs(Number(record.amount) || 0), 0);

const describeRecordsCount = (records: FinancialRecord[]) =>
  records.length
    ? `${records.length} ${records.length === 1 ? 'запись' : 'записей'}`
    : POLICY_TEXT.messages.noRecords;

const renderRecordsSummary = (
  records: FinancialRecord[],
  recordType: 'income' | 'expense',
  compact = false,
) => {
  if (!records.length) {
    return (
      <span className={compact ? 'text-[11px] text-slate-500' : 'text-xs text-slate-500'}>
        {POLICY_TEXT.messages.noRecords}
      </span>
    );
  }

  return (
    <div className={compact ? 'space-y-0.5' : 'space-y-1'}>
      <p className={compact ? 'text-[11px] text-slate-500' : 'text-xs text-slate-500'}>
        {describeRecordsCount(records)}
      </p>
      <p className={`text-xs font-semibold ${RECORD_TYPE_TONE[recordType]}`}>
        {recordType === 'income' ? '+' : '-'}
        {formatCurrency(getRecordsAmount(records).toString())}
      </p>
    </div>
  );
};

const renderRecordList = (
  records: FinancialRecord[],
  recordType: 'income' | 'expense',
  onEditRecord: (recordId: string) => void,
  onDeleteRecord: (recordId: string) => Promise<void>,
  compact: boolean,
) => {
  if (!records.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        {POLICY_TEXT.messages.noRecords}
      </p>
    );
  }

  const recordClassName = compact
    ? 'flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs'
    : 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm';

  const listClassName = compact ? 'space-y-1' : 'space-y-2';

  return (
    <div className={listClassName}>
      {records.map((record) => {
        const amountValue = Math.abs(Number(record.amount) || 0);
        const tone = recordType === 'income' ? 'text-emerald-600' : 'text-rose-600';
        const sign = recordType === 'income' ? '+' : '-';

        const recordTitle = record.note || 'Без примечания';

        return (
          <div key={record.id} className={recordClassName}>
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-slate-800 truncate">{recordTitle}</p>
              <p className="text-[10px] text-slate-500">{formatDate(record.date)}</p>
            </div>
            <div
              className={
                compact
                  ? 'text-xs font-semibold text-slate-900'
                  : 'text-sm font-semibold text-slate-900'
              }
            >
              <span className={tone}>
                {sign}
                {formatCurrency(amountValue.toString())}
              </span>
            </div>
            <div
              className={
                compact
                  ? 'flex gap-2 text-[10px] text-slate-500'
                  : 'flex gap-3 text-[11px] text-slate-500'
              }
            >
              <button
                onClick={() => onEditRecord(record.id)}
                className={
                  compact
                    ? 'link-action text-[10px] font-semibold'
                    : 'link-action text-[11px] font-semibold'
                }
                type="button"
              >
                Изменить
              </button>
              <button
                onClick={() => onDeleteRecord(record.id).catch(() => undefined)}
                className={
                  compact
                    ? 'link-danger text-[10px] font-semibold'
                    : 'link-danger text-[11px] font-semibold'
                }
                type="button"
              >
                Удалить
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const PaymentCard: React.FC<PaymentCardProps> = ({
  payment,
  onEditPayment,
  onDeletePayment,
  onRequestAddRecord,
  onEditFinancialRecord,
  onDeleteFinancialRecord,
  variant = 'default',
  hideRowActions = false,
}) => {
  const [isIncomeExpanded, setIsIncomeExpanded] = React.useState(false);
  const [isExpenseExpanded, setIsExpenseExpanded] = React.useState(false);
  const { incomes, expenses } = React.useMemo(() => resolveRecordGroups(payment), [payment]);

  const paidText = payment.actualDate ? formatDate(payment.actualDate) : 'нет';
  const paidTone = payment.actualDate ? 'text-emerald-600' : 'text-rose-500';
  const compact = variant === 'table';
  const containerClassName = compact
    ? 'rounded-xl border border-slate-200 bg-white p-3'
    : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
  const headerClassName = compact
    ? 'flex flex-wrap items-start justify-between gap-2'
    : 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between';
  const metaClassName = compact
    ? 'flex flex-wrap items-center gap-3 text-[9px] uppercase tracking-[0.3em] text-slate-500'
    : 'flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.3em] text-slate-500';
  const recordsLayoutClassName = compact ? 'grid gap-2 lg:grid-cols-2' : 'space-y-3';
  const sectionHeaderClassName = compact
    ? 'flex flex-wrap items-center justify-between gap-2 px-2.5 py-2'
    : 'flex flex-wrap items-center justify-between gap-3 px-4 py-3';
  const sectionBodyClassName = compact ? 'px-2.5 pb-2.5' : 'px-4 pb-4';
  const spacingClassName = compact ? 'space-y-2' : 'space-y-3';

  const renderSection = (
    title: string,
    records: FinancialRecord[],
    recordType: 'income' | 'expense',
    onAdd: () => void,
  ) => {
    const toneClassName =
      recordType === 'income'
        ? 'border-emerald-200 bg-emerald-50/70'
        : 'border-rose-200 bg-rose-50/70';
    const sectionClassName = compact
      ? `rounded-lg border ${toneClassName}`
      : `rounded-2xl border ${toneClassName} shadow-inner`;

    return (
      <section className={sectionClassName}>
        <div className={sectionHeaderClassName}>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-400">
              {title}
            </p>
            <p className="text-[11px] text-slate-500">{describeRecordsCount(records)}</p>
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onAdd} className="link-action text-[11px] font-semibold">
              Добавить
            </button>
          </div>
        </div>
        <div className={sectionBodyClassName}>
          <div className="space-y-2">
            {renderRecordList(
              records,
              recordType,
              onEditFinancialRecord,
              onDeleteFinancialRecord,
              compact,
            )}
          </div>
        </div>
      </section>
    );
  };

  if (variant === 'table-row') {
    const hasExpandedDetails = isIncomeExpanded || isExpenseExpanded;
    const detailsColSpan = hideRowActions ? 6 : 7;
    const incomeToggleLabel = isIncomeExpanded
      ? POLICY_TEXT.actions.hide
      : POLICY_TEXT.actions.details;
    const expenseToggleLabel = isExpenseExpanded
      ? POLICY_TEXT.actions.hide
      : POLICY_TEXT.actions.details;

    return (
      <>
        <tr className={NESTED_TABLE_ROW_CLASS}>
          <td className={NESTED_TABLE_CELL_CLASS_COMPACT}>
            <p className="text-xs font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
          </td>
          <td className={NESTED_TABLE_CELL_CLASS_COMPACT}>
            <p className="text-xs text-slate-700">
              {payment.note || payment.description || POLICY_TEXT.paymentTable.emptyDescription}
            </p>
          </td>
          <td className={NESTED_TABLE_CELL_CLASS_COMPACT}>
            <p className="text-xs font-semibold text-slate-700">
              {formatDate(payment.scheduledDate)}
            </p>
          </td>
          <td className={NESTED_TABLE_CELL_CLASS_COMPACT}>
            <p
              className={`text-xs font-semibold ${payment.actualDate ? 'text-emerald-600' : 'text-rose-500'}`}
            >
              {payment.actualDate
                ? formatDate(payment.actualDate)
                : POLICY_TEXT.paymentTable.noDate}
            </p>
          </td>
          <td className={NESTED_TABLE_CELL_CLASS_COMPACT}>
            <div className="space-y-0.5">
              {renderRecordsSummary(incomes, 'income', true)}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onRequestAddRecord(payment.id, 'income')}
                  className="link-action text-[11px] font-semibold"
                >
                  Добавить
                </button>
                {incomes.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsIncomeExpanded((prev) => !prev)}
                    className="link-action text-[11px] font-semibold"
                  >
                    {incomeToggleLabel}
                  </button>
                )}
              </div>
            </div>
          </td>
          <td className={NESTED_TABLE_CELL_CLASS_COMPACT}>
            <div className="space-y-0.5">
              {renderRecordsSummary(expenses, 'expense', true)}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onRequestAddRecord(payment.id, 'expense')}
                  className="link-action text-[11px] font-semibold"
                >
                  Добавить
                </button>
                {expenses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsExpenseExpanded((prev) => !prev)}
                    className="link-action text-[11px] font-semibold"
                  >
                    {expenseToggleLabel}
                  </button>
                )}
              </div>
            </div>
          </td>
          {!hideRowActions && (
            <td className={NESTED_TABLE_CELL_CLASS_COMPACT}>
              <div className="flex flex-wrap items-center gap-1.5">
                {onEditPayment && (
                  <button
                    type="button"
                    onClick={() => onEditPayment(payment.id)}
                    className="link-action whitespace-nowrap text-[11px] font-semibold"
                  >
                    Изменить
                  </button>
                )}
                {onDeletePayment && (
                  <button
                    type="button"
                    onClick={() => onDeletePayment(payment.id).catch(() => undefined)}
                    className="link-danger whitespace-nowrap text-[11px] font-semibold"
                    disabled={payment.canDelete === false}
                    title={
                      payment.canDelete === false
                        ? 'Сначала удалите полученные доходы или выплаченные расходы'
                        : 'Удалить платёж'
                    }
                  >
                    Удалить
                  </button>
                )}
              </div>
            </td>
          )}
        </tr>
        {hasExpandedDetails && (
          <tr className={NESTED_TABLE_ROW_CLASS}>
            <td
              colSpan={detailsColSpan}
              className={`${NESTED_TABLE_CELL_CLASS_COMPACT} bg-slate-50/70`}
            >
              <div className="grid gap-2 lg:grid-cols-2">
                {isIncomeExpanded && (
                  <section className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                        {RECORD_TITLES.income}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRequestAddRecord(payment.id, 'income')}
                        className="link-action text-[11px] font-semibold"
                      >
                        Добавить
                      </button>
                    </div>
                    {renderRecordList(
                      incomes,
                      'income',
                      onEditFinancialRecord,
                      onDeleteFinancialRecord,
                      true,
                    )}
                  </section>
                )}
                {isExpenseExpanded && (
                  <section className="rounded-lg border border-rose-200 bg-rose-50/60 p-2">
                    <div className="mb-1.5 flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                        {RECORD_TITLES.expense}
                      </p>
                      <button
                        type="button"
                        onClick={() => onRequestAddRecord(payment.id, 'expense')}
                        className="link-action text-[11px] font-semibold"
                      >
                        Добавить
                      </button>
                    </div>
                    {renderRecordList(
                      expenses,
                      'expense',
                      onEditFinancialRecord,
                      onDeleteFinancialRecord,
                      true,
                    )}
                  </section>
                )}
              </div>
            </td>
          </tr>
        )}
      </>
    );
  }

  return (
    <div className={`${containerClassName} ${spacingClassName}`}>
      <div className={headerClassName}>
        <div className={compact ? 'min-w-0 space-y-0.5' : 'min-w-0 space-y-1'}>
          <p
            className={
              compact
                ? 'text-base font-semibold text-slate-900'
                : 'text-lg font-semibold text-slate-900'
            }
          >
            {formatCurrency(payment.amount)}
          </p>
          <p
            className={
              compact ? 'text-xs text-slate-500 truncate' : 'text-sm text-slate-500 truncate'
            }
          >
            {payment.note || payment.description || POLICY_TEXT.paymentTable.emptyDescription}
          </p>
        </div>
        <div className={metaClassName}>
          <div>
            <p className="leading-none text-[9px]">Оплатить до...</p>
            <p className="text-sm font-semibold text-slate-800">
              {formatDate(payment.scheduledDate)}
            </p>
          </div>
          <div>
            <p className="leading-none text-[9px]">Оплачен:</p>
            <p className={`text-sm font-semibold ${paidTone}`}>{paidText}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onEditPayment && (
            <button
              type="button"
              onClick={() => onEditPayment(payment.id)}
              className="link-action whitespace-nowrap text-xs font-semibold"
            >
              Изменить
            </button>
          )}
          {onDeletePayment && (
            <button
              type="button"
              onClick={() => onDeletePayment(payment.id).catch(() => undefined)}
              className="link-danger whitespace-nowrap text-xs font-semibold"
              disabled={payment.canDelete === false}
              title={
                payment.canDelete === false
                  ? 'Сначала удалите полученные доходы или выплаченные расходы'
                  : 'Удалить платёж'
              }
            >
              Удалить
            </button>
          )}
        </div>
      </div>
      <div className={recordsLayoutClassName}>
        {renderSection(RECORD_TITLES.income, incomes, 'income', () =>
          onRequestAddRecord(payment.id, 'income'),
        )}
        {renderSection(RECORD_TITLES.expense, expenses, 'expense', () =>
          onRequestAddRecord(payment.id, 'expense'),
        )}
      </div>
    </div>
  );
};
