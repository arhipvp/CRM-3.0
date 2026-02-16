import React from 'react';

import { PaymentSection } from './PaymentSection';
import type { FinancialRecordDraft, PaymentDraft } from '../types';

interface PolicyPaymentsStepProps {
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  policyDurationWarning: string | null;
  payments: PaymentDraft[];
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
  payments,
  onAddPayment,
  firstPaymentDateWarning,
  onPaymentFieldChange,
  onRemovePayment,
  onAddRecord,
  onUpdateRecord,
  onRemoveRecord,
}) => {
  return (
    <div className="space-y-6">
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="app-label">Платежи</p>
          <button type="button" onClick={onAddPayment} className="btn btn-sm btn-secondary">
            + Добавить платёж
          </button>
        </div>
        {firstPaymentDateWarning && (
          <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {firstPaymentDateWarning}
          </p>
        )}
        {payments.length === 0 && (
          <p className="text-sm text-slate-600">
            Добавьте хотя бы один платёж, чтобы связать финансовые данные.
          </p>
        )}
        <div className="space-y-4">
          {payments.map((payment, paymentIndex) => (
            <PaymentSection
              key={paymentIndex}
              paymentIndex={paymentIndex}
              payment={payment}
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
