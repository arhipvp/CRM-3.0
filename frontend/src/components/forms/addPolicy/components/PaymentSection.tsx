import React from 'react';
import { FinancialRecordInputs } from './FinancialRecordInputs';
import type { FinancialRecordDraft, PaymentDraft } from '../types';
import { LINK_ACTION_XS } from '../../../common/uiClassNames';
import type { PaymentIssue } from '../paymentIssues';

interface PaymentSectionProps {
  paymentIndex: number;
  paymentNumber?: number;
  payment: PaymentDraft;
  onFieldChange: (
    index: number,
    field: keyof Omit<PaymentDraft, 'incomes' | 'expenses'>,
    value: string,
  ) => void;
  onRemovePayment: (index: number) => void;
  onAddRecord: (index: number, type: 'incomes' | 'expenses') => void;
  onUpdateRecord: (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string,
  ) => void;
  onRemoveRecord: (paymentIndex: number, type: 'incomes' | 'expenses', recordIndex: number) => void;
  showRecords?: boolean;
  dense?: boolean;
  issues?: PaymentIssue[];
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  paymentIndex,
  paymentNumber,
  payment,
  onFieldChange,
  onRemovePayment,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
  showRecords = true,
  dense = false,
  issues = [],
}) => {
  const issuesByField = issues.reduce<Record<string, PaymentIssue[]>>((acc, issue) => {
    acc[issue.field] = [...(acc[issue.field] ?? []), issue];
    return acc;
  }, {});
  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');
  const getFieldClassName = (field: string) => {
    if (issuesByField[field]?.some((issue) => issue.severity === 'error')) {
      return 'border-rose-300 bg-rose-50/60 ring-2 ring-rose-100';
    }

    if (issuesByField[field]?.some((issue) => issue.severity === 'warning')) {
      return 'border-amber-300 bg-amber-50/60 ring-2 ring-amber-100';
    }

    return '';
  };

  return (
    <section
      data-testid="policy-payment-card"
      className={`relative overflow-hidden rounded-[28px] border border-slate-300/90 bg-gradient-to-br from-white via-white to-slate-50/90 shadow-[0_18px_42px_rgba(15,23,42,0.12)] ${
        dense ? 'space-y-3 p-4' : 'space-y-4 p-5'
      }`}
    >
      <div className="absolute inset-y-0 left-0 w-2 rounded-l-[28px] bg-gradient-to-b from-sky-500 via-cyan-500 to-emerald-400" />
      <div
        className={`ml-2 flex items-start justify-between border-b border-slate-200/90 pb-3 ${
          dense ? 'gap-3' : 'gap-4'
        }`}
      >
        <div className="space-y-2">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Платёж #{paymentNumber ?? paymentIndex + 1}
            </p>
            <p className="text-xs text-slate-500">Отдельный шаг графика</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium">
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">
              План: {payment.scheduledDate || 'не указана'}
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
              Факт: {payment.actualDate || 'не указан'}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemovePayment(paymentIndex)}
          className="link-danger rounded-full border border-rose-100 bg-rose-50/70 px-3 py-1 text-xs"
        >
          Удалить платёж
        </button>
      </div>
      {(errors.length > 0 || warnings.length > 0) && (
        <div className="ml-2 space-y-2" data-testid="policy-payment-issues">
          {errors.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {errors.map((issue) => issue.message).join(' ')}
            </div>
          )}
          {warnings.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              {warnings.map((issue) => issue.message).join(' ')}
            </div>
          )}
        </div>
      )}
      <div className={`ml-2 grid grid-cols-1 ${dense ? 'gap-3' : 'gap-4'} md:grid-cols-2`}>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Сумма</label>
          <input
            type="number"
            value={payment.amount}
            onChange={(e) => onFieldChange(paymentIndex, 'amount', e.target.value)}
            data-payment-field="amount"
            className={`field field-input mt-1 ${getFieldClassName('amount')}`}
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-slate-600">Комментарий</label>
          <input
            type="text"
            value={payment.description || ''}
            onChange={(e) => onFieldChange(paymentIndex, 'description', e.target.value)}
            data-payment-field="description"
            className={`field field-input mt-1 ${getFieldClassName('description')}`}
          />
        </div>
        <div
          className={`rounded-2xl border border-sky-200 bg-sky-50/90 p-3 shadow-inner shadow-sky-100/70 ${getFieldClassName(
            'scheduledDate',
          )}`}
        >
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-sky-800">
                Плановая дата
              </label>
              <p className="mt-1 text-[11px] text-sky-700">Главная дата для графика полиса</p>
            </div>
            <span className="rounded-full bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              Ключевая
            </span>
          </div>
          <input
            type="date"
            value={payment.scheduledDate || ''}
            onChange={(e) => onFieldChange(paymentIndex, 'scheduledDate', e.target.value)}
            data-payment-field="scheduled-date"
            className={`field field-input border-sky-300 bg-white ring-2 ring-sky-100/80 ${getFieldClassName(
              'scheduledDate',
            )}`}
          />
        </div>
        <div
          className={`rounded-2xl border border-slate-200 bg-white p-3 ${getFieldClassName(
            'actualDate',
          )}`}
        >
          <div className="mb-2">
            <label className="block text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              Фактическая дата
            </label>
            <p className="mt-1 text-[11px] text-slate-500">Когда платёж реально поступил</p>
          </div>
          <input
            type="date"
            value={payment.actualDate || ''}
            onChange={(e) => onFieldChange(paymentIndex, 'actualDate', e.target.value)}
            data-payment-field="actual-date"
            className={`field field-input bg-white ${getFieldClassName('actualDate')}`}
          />
        </div>
      </div>

      {showRecords && (
        <div className={dense ? 'space-y-2' : 'space-y-3'}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Доходы
              </h4>
              <button
                type="button"
                className={LINK_ACTION_XS}
                onClick={() => onAddRecord(paymentIndex, 'incomes')}
              >
                + Добавить доход
              </button>
            </div>
            {payment.incomes.length === 0 && (
              <p className="text-xs text-slate-500">
                Добавьте доход, чтобы привязать поступление к этому платежу.
              </p>
            )}
            <FinancialRecordInputs
              paymentIndex={paymentIndex}
              type="incomes"
              records={payment.incomes}
              onUpdateRecord={onUpdateRecord}
              onRemoveRecord={onRemoveRecord}
            />
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Расходы
              </h4>
              <button
                type="button"
                className={LINK_ACTION_XS}
                onClick={() => onAddRecord(paymentIndex, 'expenses')}
              >
                + Добавить расход
              </button>
            </div>
            {payment.expenses.length === 0 && (
              <p className="text-xs text-slate-500">
                Добавьте расход, чтобы контролировать связанные списания.
              </p>
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
};
