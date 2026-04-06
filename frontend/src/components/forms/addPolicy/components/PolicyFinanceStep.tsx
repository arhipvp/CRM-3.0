import React from 'react';

import { formatCurrency, formatDate } from '../../../views/dealsView/helpers';
import { FinancialRecordInputs } from './FinancialRecordInputs';
import type { FinancialRecordDraft, PaymentDraft } from '../types';
import type { PaymentDraftOrderEntry } from '../paymentDraftOrdering';

interface PolicyFinanceStepProps {
  counterparty: string;
  onCounterpartyChange: (value: string) => void;
  onCounterpartyTouched: () => void;
  onAddCounterpartyExpenses: () => void;
  executorName?: string | null;
  onAddExecutorExpenses: () => void;
  paymentEntries: PaymentDraftOrderEntry[];
  expandedPaymentIndex: number | null;
  onTogglePaymentDetails: (index: number) => void;
  onExpandPaymentDetails: (index: number) => void;
  onAddRecord: (paymentIndex: number, type: 'incomes' | 'expenses') => void;
  onUpdateRecord: (
    paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string,
  ) => void;
  onRemoveRecord: (paymentIndex: number, type: 'incomes' | 'expenses', recordIndex: number) => void;
}

export const PolicyFinanceStep: React.FC<PolicyFinanceStepProps> = ({
  counterparty,
  onCounterpartyChange,
  onCounterpartyTouched,
  onAddCounterpartyExpenses,
  executorName,
  onAddExecutorExpenses,
  paymentEntries,
  expandedPaymentIndex,
  onTogglePaymentDetails,
  onExpandPaymentDetails,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
}) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-inner shadow-slate-200/40 md:p-5">
          <label className="app-label">Контрагент</label>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={counterparty}
              onChange={(event) => {
                onCounterpartyChange(event.target.value);
                onCounterpartyTouched();
              }}
              className="field field-input flex-1"
              placeholder="Контрагент / организация"
            />
            <button
              type="button"
              onClick={onAddCounterpartyExpenses}
              className="btn btn-sm btn-secondary whitespace-nowrap"
            >
              + Расход
            </button>
          </div>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-inner shadow-slate-200/40 md:p-5">
          <label className="app-label">Исполнитель по сделке</label>
          <div className="mt-3 flex flex-wrap gap-2">
            <input
              type="text"
              value={executorName ?? 'отсутствует'}
              readOnly
              className="field field-input flex-1 bg-slate-50 text-slate-900"
            />
            <button
              type="button"
              onClick={onAddExecutorExpenses}
              disabled={!executorName?.trim()}
              className="btn btn-sm btn-secondary whitespace-nowrap"
            >
              + Расход
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-5" data-testid="policy-finance-payment-list">
        {paymentEntries.map((entry, displayIndex) => {
          const { payment, sourceIndex } = entry;
          const isExpanded = expandedPaymentIndex === sourceIndex;
          return (
            <section
              key={`records-${sourceIndex}`}
              className="relative overflow-hidden rounded-[28px] border border-slate-300/90 bg-gradient-to-br from-white via-white to-slate-50/90 shadow-[0_18px_42px_rgba(15,23,42,0.12)]"
              data-testid="policy-finance-payment-card"
            >
              <div className="absolute inset-y-0 left-0 w-2 rounded-l-[28px] bg-gradient-to-b from-sky-500 via-cyan-500 to-emerald-400" />
              <div className="ml-2 flex flex-col gap-3 border-b border-slate-200/90 px-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <p className="text-sm font-semibold text-slate-900">
                    {payment.description || `Платёж #${displayIndex + 1}`}
                  </p>
                  <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                      Сумма {formatCurrency(payment.amount || '0')}
                    </span>
                    <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-700">
                      План {formatDate(payment.scheduledDate)}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 ${
                        payment.actualDate
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {payment.actualDate
                        ? `Оплачен ${formatDate(payment.actualDate)}`
                        : 'Не оплачен'}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onAddRecord(sourceIndex, 'incomes');
                      onExpandPaymentDetails(sourceIndex);
                    }}
                    className="btn btn-sm btn-secondary"
                  >
                    + Доход
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddRecord(sourceIndex, 'expenses');
                      onExpandPaymentDetails(sourceIndex);
                    }}
                    className="btn btn-sm btn-secondary"
                  >
                    + Расход
                  </button>
                  <button
                    type="button"
                    onClick={() => onTogglePaymentDetails(sourceIndex)}
                    className="btn btn-sm btn-secondary whitespace-nowrap"
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? 'Свернуть' : 'Развернуть'}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="ml-2 space-y-4 px-4 pb-4 pt-4">
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 shadow-inner">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Доходы
                      </h4>
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => onAddRecord(sourceIndex, 'incomes')}
                      >
                        + Добавить доход
                      </button>
                    </div>
                    {payment.incomes.length === 0 && (
                      <p className="text-sm text-slate-600">
                        Добавьте доход, чтобы привязать поступление к этому платежу.
                      </p>
                    )}
                    <FinancialRecordInputs
                      paymentIndex={sourceIndex}
                      type="incomes"
                      records={payment.incomes}
                      onUpdateRecord={onUpdateRecord}
                      onRemoveRecord={onRemoveRecord}
                    />
                  </div>
                  <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 shadow-inner">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Расходы
                      </h4>
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => onAddRecord(sourceIndex, 'expenses')}
                      >
                        + Добавить расход
                      </button>
                    </div>
                    {payment.expenses.length === 0 && (
                      <p className="text-sm text-slate-600">
                        Добавьте расход, чтобы контролировать связанные списания.
                      </p>
                    )}
                    <FinancialRecordInputs
                      paymentIndex={sourceIndex}
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
        })}
      </div>
    </div>
  );
};
