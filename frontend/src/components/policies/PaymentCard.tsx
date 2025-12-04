import React from 'react';
import type { FinancialRecord, Payment } from '../../types';
import { formatCurrency, formatDate } from '../views/dealsView/helpers';

interface PaymentCardProps {
  payment: Payment;
  onEditPayment?: (paymentId: string) => void;
  onRequestAddRecord: (paymentId: string, recordType: 'income' | 'expense') => void;
  onEditFinancialRecord: (recordId: string) => void;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
}

const RECORD_TITLES: Record<'income' | 'expense', string> = {
  income: 'Доходы',
  expense: 'Расходы',
};

const renderRecordRows = (
  records: FinancialRecord[],
  recordType: 'income' | 'expense',
  onEditRecord: (recordId: string) => void,
  onDeleteRecord: (recordId: string) => Promise<void>
) => {
  if (!records.length) {
    return (
      <tr>
        <td colSpan={4} className="px-2 py-1 text-[11px] text-center text-slate-400">
          Записей нет
        </td>
      </tr>
    );
  }

  return records.map((record) => {
    const amountValue = Math.abs(Number(record.amount) || 0);
    const sign = recordType === 'income' ? '+' : '-';

    return (
      <tr key={record.id}>
        <td className="px-2 py-1 text-[11px] text-slate-600">{record.description || 'Без описания'}</td>
        <td className="px-2 py-1 text-[11px] text-slate-600">{formatDate(record.date)}</td>
        <td className="px-2 py-1 text-right text-[11px] font-semibold text-slate-900">
          <span className={recordType === 'income' ? 'text-emerald-600' : 'text-rose-600'}>
            {sign}
            {formatCurrency(amountValue.toString())}
          </span>
        </td>
        <td className="px-2 py-1 text-right text-[11px] text-slate-600 space-x-2">
          <button
            onClick={() => onEditRecord(record.id)}
            className="text-[11px] text-sky-600 hover:text-sky-800 font-semibold"
            type="button"
          >
            Изменить
          </button>
          <button
            onClick={() => onDeleteRecord(record.id).catch(() => undefined)}
            className="text-[11px] text-rose-500 hover:text-rose-600 font-semibold"
            type="button"
          >
            Удалить
          </button>
        </td>
      </tr>
    );
  });
};

export const PaymentCard: React.FC<PaymentCardProps> = ({
  payment,
  onEditPayment,
  onRequestAddRecord,
  onEditFinancialRecord,
  onDeleteFinancialRecord,
}) => {
  const incomes =
    payment.financialRecords?.filter((record) => record.recordType === 'Доход') || [];
  const expenses =
    payment.financialRecords?.filter((record) => record.recordType === 'Расход') || [];

  const paidText = payment.actualDate ? formatDate(payment.actualDate) : 'нет';
  const paidTone = payment.actualDate ? 'text-emerald-600' : 'text-rose-500';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
          <p className="text-xs text-slate-500 truncate">{payment.note || payment.description || 'Без описания'}</p>
        </div>
        <div className="flex flex-wrap gap-4 text-[10px] text-slate-500 sm:text-[11px]">
          <div>
            <p className="uppercase tracking-[0.3em] text-[9px]">Оплатить до...</p>
            <p className="text-sm font-semibold text-slate-800">{formatDate(payment.scheduledDate)}</p>
          </div>
          <div>
            <p className="uppercase tracking-[0.3em] text-[9px]">Оплачен:</p>
            <p className={`text-sm font-semibold ${paidTone}`}>{paidText}</p>
          </div>
        </div>
        {onEditPayment && (
          <button
            type="button"
            onClick={() => onEditPayment(payment.id)}
            className="text-xs font-semibold text-sky-600 hover:text-sky-800 whitespace-nowrap"
          >
            Изменить
          </button>
        )}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <span>{RECORD_TITLES.income}</span>
            <button
              type="button"
              onClick={() => onRequestAddRecord(payment.id, 'income')}
              className="text-[10px] font-semibold text-sky-600 hover:text-sky-800"
            >
              Добавить
            </button>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-[11px] text-slate-600">
              <thead>
                <tr className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                  <th className="px-2 py-1 text-left">Описание</th>
                  <th className="px-2 py-1 text-left">Дата</th>
                  <th className="px-2 py-1 text-right">Сумма</th>
                  <th className="px-2 py-1 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>{renderRecordRows(incomes, 'income', onEditFinancialRecord, onDeleteFinancialRecord)}</tbody>
            </table>
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            <span>{RECORD_TITLES.expense}</span>
            <button
              type="button"
              onClick={() => onRequestAddRecord(payment.id, 'expense')}
              className="text-[10px] font-semibold text-sky-600 hover:text-sky-800"
            >
              Добавить
            </button>
          </div>
          <div className="mt-2 overflow-x-auto">
            <table className="min-w-full text-[11px] text-slate-600">
              <thead>
                <tr className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                  <th className="px-2 py-1 text-left">Описание</th>
                  <th className="px-2 py-1 text-left">Дата</th>
                  <th className="px-2 py-1 text-right">Сумма</th>
                  <th className="px-2 py-1 text-right">Действия</th>
                </tr>
              </thead>
              <tbody>{renderRecordRows(expenses, 'expense', onEditFinancialRecord, onDeleteFinancialRecord)}</tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
