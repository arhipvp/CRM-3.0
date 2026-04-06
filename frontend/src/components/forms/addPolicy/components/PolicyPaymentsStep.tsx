import React from 'react';

import { PaymentSection } from './PaymentSection';
import type { FinancialRecordDraft, PaymentDraft } from '../types';
import type { PaymentDraftOrderEntry } from '../paymentDraftOrdering';

interface PolicyPaymentsStepProps {
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  policyDurationWarning: string | null;
  paymentEntries: PaymentDraftOrderEntry[];
  onAddPayment: () => void;
  firstPaymentDateWarning: string | null;
  onPaymentFieldChange: (
    index: number,
    field: keyof Omit<PaymentDraft, 'incomes' | 'expenses'>,
    value: string,
  ) => void;
  onRemovePayment: (index: number) => void;
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

export const PolicyPaymentsStep: React.FC<PolicyPaymentsStepProps> = ({
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  policyDurationWarning,
  paymentEntries,
  onAddPayment,
  firstPaymentDateWarning,
  onPaymentFieldChange,
  onRemovePayment,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
}) => {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="app-label">Дата начала</label>
          <input
            type="date"
            value={startDate}
            onChange={(event) => onStartDateChange(event.target.value)}
            className="field field-input mt-2"
          />
        </div>
        <div>
          <label className="app-label">Дата окончания</label>
          <input
            type="date"
            value={endDate}
            onChange={(event) => onEndDateChange(event.target.value)}
            className="field field-input mt-2"
          />
        </div>
      </div>

      {policyDurationWarning && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {policyDurationWarning}
        </p>
      )}

      <div className="rounded-[28px] border border-slate-200 bg-slate-50/70 p-4 shadow-inner shadow-slate-200/40 md:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="app-label">Платежи</p>
            <p className="mt-1 text-sm text-slate-600">
              Плановые даты идут по порядку, чтобы график было проще проверить.
            </p>
          </div>
          <button type="button" onClick={onAddPayment} className="btn btn-sm btn-secondary">
            + Добавить платёж
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {firstPaymentDateWarning && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {firstPaymentDateWarning}
            </p>
          )}
          {paymentEntries.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-600">
              Добавьте хотя бы один платёж, чтобы связать финансовые данные.
            </p>
          )}
        </div>
        <div
          className="mt-4 max-h-[min(46vh,34rem)] space-y-3 overflow-y-auto pr-1"
          data-testid="policy-payment-list"
        >
          {paymentEntries.map((entry, displayIndex) => (
            <PaymentSection
              key={entry.payment.id ?? `payment-${entry.sourceIndex}`}
              paymentIndex={entry.sourceIndex}
              paymentNumber={displayIndex + 1}
              payment={entry.payment}
              onFieldChange={onPaymentFieldChange}
              onRemovePayment={onRemovePayment}
              onAddRecord={onAddRecord}
              onUpdateRecord={onUpdateRecord}
              onRemoveRecord={onRemoveRecord}
              showRecords={false}
              dense
            />
          ))}
        </div>
      </div>
    </div>
  );
};
