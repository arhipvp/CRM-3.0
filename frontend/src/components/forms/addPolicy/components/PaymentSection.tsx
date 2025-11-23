import React from 'react';
import { FinancialRecordInputs } from './FinancialRecordInputs';
import type { FinancialRecordDraft, PaymentDraft } from '../types';

interface PaymentSectionProps {
  paymentIndex: number;
  payment: PaymentDraft;
  activeTab: 'incomes' | 'expenses';
  onFieldChange: (index: number, field: keyof Omit<PaymentDraft, 'incomes' | 'expenses'>, value: string) => void;
  onRemovePayment: (index: number) => void;
  onTabChange: (index: number, tab: 'incomes' | 'expenses') => void;
  onAddRecord: (index: number, type: 'incomes' | 'expenses') => void;
  onUpdateRecord: (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string
  ) => void;
  onRemoveRecord: (paymentIndex: number, type: 'incomes' | 'expenses', recordIndex: number) => void;
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  paymentIndex,
  payment,
  activeTab,
  onFieldChange,
  onRemovePayment,
  onTabChange,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
}) => (
  <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

    <div className="flex gap-2">
      {(['incomes', 'expenses'] as const).map((tab) => (
        <button
          key={tab}
          type="button"
          className={`px-3 py-1 text-xs font-medium rounded-full border ${
            activeTab === tab
              ? 'border-sky-600 text-sky-600 bg-sky-50'
              : 'border-slate-200 text-slate-500'
          }`}
          onClick={() => onTabChange(paymentIndex, tab)}
        >
          {tab === 'incomes' ? 'Доходы' : 'Расходы'}
        </button>
      ))}
    </div>

    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-700">
          {activeTab === 'incomes' ? 'Доходы' : 'Расходы'}
        </h4>
        <button
          type="button"
          className="text-xs text-sky-600 hover:underline"
          onClick={() => onAddRecord(paymentIndex, activeTab)}
        >
          + Добавить {activeTab === 'incomes' ? 'источник дохода' : 'расход'}
        </button>
      </div>
      <FinancialRecordInputs
        paymentIndex={paymentIndex}
        type={activeTab}
        records={payment[activeTab]}
        onUpdateRecord={onUpdateRecord}
        onRemoveRecord={onRemoveRecord}
      />
    </div>
  </section>
);
