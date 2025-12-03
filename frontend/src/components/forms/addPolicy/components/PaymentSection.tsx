import React from 'react';
import { FinancialRecordInputs } from './FinancialRecordInputs';
import type { FinancialRecordDraft, PaymentDraft } from '../types';

interface PaymentSectionProps {
  paymentIndex: number;
  payment: PaymentDraft;
  onFieldChange: (index: number, field: keyof Omit<PaymentDraft, 'incomes' | 'expenses'>, value: string) => void;
  onRemovePayment: (index: number) => void;
  onAddRecord: (index: number, type: 'incomes' | 'expenses') => void;
  onUpdateRecord: (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string
  ) => void;
  onRemoveRecord: (paymentIndex: number, type: 'incomes' | 'expenses', recordIndex: number) => void;
  showRecords?: boolean;
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  paymentIndex,
  payment,
  onFieldChange,
  onRemovePayment,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
  showRecords = true,
}) => (
  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-semibold text-slate-900">Платёж #{paymentIndex + 1}</p>
        <p className="text-xs text-slate-500">Отражён в расписании</p>
      </div>
      <button
        type="button"
        onClick={() => onRemovePayment(paymentIndex)}
        className="text-xs text-red-500 hover:underline"
      >
        Удалить платёж
      </button>
    </div>
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <label className="block text-xs font-medium text-slate-600">Сумма</label>
        <input
          type="number"
          value={payment.amount}
          onChange={(e) => onFieldChange(paymentIndex, 'amount', e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Комментарий</label>
        <input
          type="text"
          value={payment.description || ''}
          onChange={(e) => onFieldChange(paymentIndex, 'description', e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Плановая дата</label>
        <input
          type="date"
          value={payment.scheduledDate || ''}
          onChange={(e) => onFieldChange(paymentIndex, 'scheduledDate', e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600">Фактическая дата</label>
        <input
          type="date"
          value={payment.actualDate || ''}
          onChange={(e) => onFieldChange(paymentIndex, 'actualDate', e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
      </div>
    </div>

    {showRecords && (
      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Доходы</h4>
            <button
              type="button"
              className="text-xs text-sky-600 hover:underline"
              onClick={() => onAddRecord(paymentIndex, 'incomes')}
            >
              + Добавить доход
            </button>
          </div>
          {payment.incomes.length === 0 && (
            <p className="text-xs text-slate-500">Добавьте доход, чтобы привязать поступление к этому платежу.</p>
          )}
          <FinancialRecordInputs
            paymentIndex={paymentIndex}
            type="incomes"
            records={payment.incomes}
            onUpdateRecord={onUpdateRecord}
            onRemoveRecord={onRemoveRecord}
          />
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Расходы</h4>
            <button
              type="button"
              className="text-xs text-sky-600 hover:underline"
              onClick={() => onAddRecord(paymentIndex, 'expenses')}
            >
              + Добавить расход
            </button>
          </div>
          {payment.expenses.length === 0 && (
            <p className="text-xs text-slate-500">Добавьте расход, чтобы контролировать связанные списания.</p>
          )}
          <FinancialRecordInputs
            paymentIndex={paymentIndex}
            type="expenses"
            records={payment.expenses}
            onUpdateRecord={onUpdateRecord}
            onRemoveRecord={onRemoveRecord}
          />
        </div>
      </div>
    )}
  </section>
);
