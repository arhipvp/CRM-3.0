import React from 'react';
import type { FinancialRecord, Payment } from '../../types';
import { formatCurrency, formatDate } from '../views/dealsView/helpers';

interface PaymentCardProps {
  payment: Payment;
  onEditPayment?: (paymentId: string) => void;
  onRequestAddRecord: (paymentId: string, recordType: 'income' | 'expense') => void;
  onEditFinancialRecord: (recordId: string) => void;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  recordsExpandedOverride?: boolean;
  variant?: 'default' | 'table';
}

const RECORD_TITLES: Record<'income' | 'expense', string> = {
  income: 'Доходы',
  expense: 'Расходы',
};

const renderRecordList = (
  records: FinancialRecord[],
  recordType: 'income' | 'expense',
  onEditRecord: (recordId: string) => void,
  onDeleteRecord: (recordId: string) => Promise<void>,
  compact: boolean
) => {
  if (!records.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        Записей нет
      </p>
    );
  }

  const recordClassName = compact
    ? 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs'
    : 'flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm';

  return (
    <div className="space-y-2">
      {records.map((record) => {
        const amountValue = Math.abs(Number(record.amount) || 0);
        const tone = recordType === 'income' ? 'text-emerald-600' : 'text-rose-600';
        const sign = recordType === 'income' ? '+' : '-';

        return (
          <div
            key={record.id}
            className={recordClassName}
          >
            <div className="min-w-0 space-y-0.5">
              <p className="font-semibold text-slate-800">{record.description || 'Без описания'}</p>
              <p className="text-[11px] text-slate-500">{formatDate(record.date)}</p>
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-900">
              <span className={tone}>
                {sign}
                {formatCurrency(amountValue.toString())}
              </span>
            </div>
            <div className="flex gap-3 text-[11px] text-slate-500">
              <button
                onClick={() => onEditRecord(record.id)}
                className="link-action text-[11px] font-semibold"
                type="button"
              >
                Изменить
              </button>
              <button
                onClick={() => onDeleteRecord(record.id).catch(() => undefined)}
                className="link-danger text-[11px] font-semibold"
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

const describeRecordsCount = (records: FinancialRecord[]) =>
  records.length ? `${records.length} ${records.length === 1 ? 'запись' : 'записей'}` : 'Нет записей';

export const PaymentCard: React.FC<PaymentCardProps> = ({
  payment,
  onEditPayment,
  onRequestAddRecord,
  onEditFinancialRecord,
  onDeleteFinancialRecord,
  variant = 'default',
}) => {
  const incomes =
    payment.financialRecords?.filter((record) => record.recordType === 'Доход') || [];
  const expenses =
    payment.financialRecords?.filter((record) => record.recordType === 'Расход') || [];

  const paidText = payment.actualDate ? formatDate(payment.actualDate) : 'нет';
  const paidTone = payment.actualDate ? 'text-emerald-600' : 'text-rose-500';
  const compact = variant === 'table';
  const containerClassName = compact
    ? 'rounded-xl border border-slate-200 bg-white p-3'
    : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';

  const renderSection = (
    title: string,
    records: FinancialRecord[],
    recordType: 'income' | 'expense',
    onAdd: () => void
  ) => (
    <section className={compact ? 'rounded-xl border border-slate-200 bg-slate-50' : 'rounded-2xl border border-slate-200 bg-slate-50 shadow-inner'}>
      <div className={compact ? 'flex flex-wrap items-center justify-between gap-3 px-3 py-2' : 'flex flex-wrap items-center justify-between gap-3 px-4 py-3'}>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-400">{title}</p>
          <p className="text-[11px] text-slate-500">{describeRecordsCount(records)}</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onAdd}
            className="link-action text-[11px] font-semibold"
          >
            Добавить
          </button>
        </div>
      </div>
      <div className={compact ? 'px-3 pb-3' : 'px-4 pb-4'}>
        <div className="space-y-2">
          {renderRecordList(records, recordType, onEditFinancialRecord, onDeleteFinancialRecord, compact)}
        </div>
      </div>
    </section>
  );

  return (
    <div className={`${containerClassName} space-y-3`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className={compact ? 'text-base font-semibold text-slate-900' : 'text-lg font-semibold text-slate-900'}>
            {formatCurrency(payment.amount)}
          </p>
          <p className="text-sm text-slate-500 truncate">{payment.note || payment.description || 'Без описания'}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.3em] text-slate-500">
          <div>
            <p className="leading-none text-[9px]">Оплатить до...</p>
            <p className="text-sm font-semibold text-slate-800">{formatDate(payment.scheduledDate)}</p>
          </div>
          <div>
            <p className="leading-none text-[9px]">Оплачен:</p>
            <p className={`text-sm font-semibold ${paidTone}`}>{paidText}</p>
          </div>
        </div>
        {onEditPayment && (
          <button
            type="button"
            onClick={() => onEditPayment(payment.id)}
            className="link-action whitespace-nowrap text-xs font-semibold"
          >
            Изменить
          </button>
        )}
      </div>
      <div className={compact ? 'space-y-2' : 'space-y-3'}>
        {renderSection(RECORD_TITLES.income, incomes, 'income', () =>
          onRequestAddRecord(payment.id, 'income')
        )}
        {renderSection(RECORD_TITLES.expense, expenses, 'expense', () =>
          onRequestAddRecord(payment.id, 'expense')
        )}
      </div>
    </div>
  );
};
