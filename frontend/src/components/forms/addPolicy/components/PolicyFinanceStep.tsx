import React from 'react';

import { formatCurrency, formatDate } from '../../../views/dealsView/helpers';
import { FinancialRecordInputs } from './FinancialRecordInputs';
import type { FinancialRecordDraft, PaymentDraft } from '../types';

interface PolicyFinanceStepProps {
  counterparty: string;
  onCounterpartyChange: (value: string) => void;
  onCounterpartyTouched: () => void;
  onAddCounterpartyExpenses: () => void;
  executorName?: string | null;
  onAddExecutorExpenses: () => void;
  payments: PaymentDraft[];
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
  payments,
  expandedPaymentIndex,
  onTogglePaymentDetails,
  onExpandPaymentDetails,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
}) => {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="app-label">Контрагент</label>
          <div className="mt-2 flex flex-wrap gap-2">
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
        <div>
          <label className="app-label">Исполнитель по сделке</label>
          <div className="mt-2 flex flex-wrap gap-2">
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

      <div className="space-y-4">
        {payments.map((payment, paymentIndex) => {
          const isExpanded = expandedPaymentIndex === paymentIndex;
          return (
            <section
              key={`records-${paymentIndex}`}
              className="rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-3 px-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-sm font-semibold text-slate-900">
                    {payment.description || `Платёж #${paymentIndex + 1}`}
                  </p>
                  <p className="flex flex-wrap gap-3 text-xs text-slate-500">
                    <span>Сумма {formatCurrency(payment.amount || '0')}</span>
                    <span>План {formatDate(payment.scheduledDate)}</span>
                    <span className={payment.actualDate ? 'text-emerald-600' : 'text-rose-600'}>
                      Оплачен {payment.actualDate ? formatDate(payment.actualDate) : 'не оплачен'}
                    </span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onAddRecord(paymentIndex, 'incomes');
                      onExpandPaymentDetails(paymentIndex);
                    }}
                    className="btn btn-sm btn-secondary"
                  >
                    + Доход
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onAddRecord(paymentIndex, 'expenses');
                      onExpandPaymentDetails(paymentIndex);
                    }}
                    className="btn btn-sm btn-secondary"
                  >
                    + Расход
                  </button>
                  <button
                    type="button"
                    onClick={() => onTogglePaymentDetails(paymentIndex)}
                    className="btn btn-sm btn-secondary whitespace-nowrap"
                  >
                    {isExpanded ? 'Свернуть' : 'Развернуть'}
                  </button>
                </div>
              </div>
              {isExpanded && (
                <div className="space-y-3 border-t border-slate-100 px-4 pb-4 pt-3">
                  <div className="app-panel-muted p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Доходы
                      </h4>
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => onAddRecord(paymentIndex, 'incomes')}
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
                      paymentIndex={paymentIndex}
                      type="incomes"
                      records={payment.incomes}
                      onUpdateRecord={onUpdateRecord}
                      onRemoveRecord={onRemoveRecord}
                    />
                  </div>
                  <div className="app-panel-muted p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Расходы
                      </h4>
                      <button
                        type="button"
                        className="btn btn-sm btn-quiet"
                        onClick={() => onAddRecord(paymentIndex, 'expenses')}
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
        })}
      </div>
    </div>
  );
};
