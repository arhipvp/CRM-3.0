import React, { useEffect, useState } from 'react';
import { Payment, Policy } from '../../types';
import { PaymentMetadata } from './addPayment/PaymentMetadata';
import { PolicyField } from './addPayment/PolicyField';
import { DealField } from './addPayment/DealField';
import { DatesFields } from './addPayment/DatesFields';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { FormActions } from '../common/forms/FormActions';
import { FormError } from '../common/forms/FormError';
import { FormField } from '../common/forms/FormField';
import { FORM_INPUT_DISABLED, FORM_TEXTAREA_DISABLED } from '../common/forms/formClassNames';
import { Button } from '../common/Button';
import { EmptyState } from '../common/EmptyState';
import { Panel } from '../common/layoutPrimitives';
import { FinancialRecordInputs } from './addPolicy/components/FinancialRecordInputs';
import { buildDefaultPaymentExpenses } from './addPolicy/policyFormState';
import { createEmptyRecord, createPaymentWithDefaultIncome } from './addPolicy/types';
import type { FinancialRecordDraft } from './addPolicy/types';

export interface AddPaymentFormValues {
  policyId?: string;
  dealId?: string | null;
  amount: string;
  description?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
  incomes?: FinancialRecordDraft[];
  expenses?: FinancialRecordDraft[];
}

interface AddPaymentFormProps {
  payment?: Payment;
  onSubmit: (data: AddPaymentFormValues) => Promise<void>;
  onCancel: () => void;
  dealId?: string;
  dealTitle?: string;
  policies?: Policy[];
  fixedPolicyId?: string;
}

export function AddPaymentForm({
  payment,
  onSubmit,
  onCancel,
  dealId,
  dealTitle,
  policies,
  fixedPolicyId,
}: AddPaymentFormProps) {
  const [formData, setFormData] = useState<AddPaymentFormValues>({
    policyId: payment?.policyId || fixedPolicyId || '',
    dealId: payment?.dealId || dealId || '',
    amount: payment?.amount || '',
    description: payment?.description || '',
    scheduledDate: payment?.scheduledDate || '',
    actualDate: payment?.actualDate || '',
  });

  const dealDisplayValue = dealTitle || dealId || formData.dealId || '';
  const dealIsFixed = Boolean(dealId);
  const policyOptions = policies ?? [];
  const fixedPolicy = fixedPolicyId
    ? policyOptions.find((policy) => policy.id === fixedPolicyId)
    : undefined;
  const fixedPolicyDisplay = fixedPolicy?.number || fixedPolicy?.id || fixedPolicyId || '';
  const [records, setRecords] = useState(() => {
    if (payment) {
      return { incomes: [] as FinancialRecordDraft[], expenses: [] as FinancialRecordDraft[] };
    }
    return {
      incomes: createPaymentWithDefaultIncome().incomes,
      expenses: buildDefaultPaymentExpenses(fixedPolicy?.counterparty),
    };
  });

  useEffect(() => {
    if (!dealId) {
      return;
    }
    setFormData((prev) => (prev.dealId === dealId ? prev : { ...prev, dealId }));
  }, [dealId]);

  useEffect(() => {
    if (!fixedPolicyId) {
      return;
    }
    setFormData((prev) =>
      prev.policyId === fixedPolicyId ? prev : { ...prev, policyId: fixedPolicyId },
    );
  }, [fixedPolicyId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value || null,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.amount) {
        throw new Error('Сумма платёжного поручения обязательна');
      }
      if (!formData.policyId) {
        throw new Error('Выберите полис');
      }

      const submission: AddPaymentFormValues = {
        ...formData,
        dealId: dealId ?? (formData.dealId || undefined),
        ...(payment ? {} : records),
      };

      await onSubmit(submission);
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось сохранить платёж'));
    } finally {
      setLoading(false);
    }
  };

  const addRecord = (type: 'incomes' | 'expenses') => {
    setRecords((prev) => ({
      ...prev,
      [type]: [...prev[type], createEmptyRecord(type === 'expenses' ? '1' : '0')],
    }));
  };

  const updateRecord = (
    _paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
    field: keyof FinancialRecordDraft,
    value: string,
  ) => {
    setRecords((prev) => ({
      ...prev,
      [type]: prev[type].map((record, index) =>
        index === recordIndex ? { ...record, [field]: value } : record,
      ),
    }));
  };

  const removeRecord = (
    _paymentIndex: number,
    type: 'incomes' | 'expenses',
    recordIndex: number,
  ) => {
    setRecords((prev) => ({
      ...prev,
      [type]: prev[type].filter((_, index) => index !== recordIndex),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="app-panel p-6 shadow-none space-y-6">
      <FormError message={error} />

      {payment && <PaymentMetadata payment={payment} />}

      <PolicyField
        policyId={formData.policyId || ''}
        onChange={handleChange}
        policyOptions={policyOptions}
        loading={loading}
        fixedPolicyId={fixedPolicyId}
        fixedPolicyDisplay={fixedPolicyDisplay}
        fixedPolicy={fixedPolicy}
      />

      <DealField
        dealDisplayValue={dealDisplayValue}
        dealId={dealId || formData.dealId || ''}
        dealIsFixed={dealIsFixed}
        loading={loading}
        value={formData.dealId || ''}
        onChange={(e) => setFormData((prev) => ({ ...prev, dealId: e.target.value || null }))}
      />

      <FormField label="Сумма (руб.)" htmlFor="amount" required>
        <input
          type="number"
          id="amount"
          name="amount"
          value={formData.amount}
          onChange={handleChange}
          placeholder="0.00"
          step="0.01"
          disabled={loading}
          required
          className={FORM_INPUT_DISABLED}
        />
      </FormField>

      <FormField label="Комментарий" htmlFor="description">
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          placeholder="Комментарий к платёжному поручению"
          rows={3}
          disabled={loading}
          className={FORM_TEXTAREA_DISABLED}
        />
      </FormField>

      <DatesFields
        scheduledDate={formData.scheduledDate}
        actualDate={formData.actualDate}
        onChange={handleChange}
        loading={loading}
      />

      {!payment && (
        <Panel variant="muted" padding="md" className="space-y-4">
          <div>
            <p className="app-label">Финансовые записи</p>
            <p className="mt-1 text-xs text-slate-500">
              Доходы и расходы будут созданы вместе с платежом.
            </p>
          </div>

          {(['incomes', 'expenses'] as const).map((type) => {
            const isIncome = type === 'incomes';
            const title = isIncome ? 'Доходы' : 'Расходы';
            const addLabel = isIncome ? 'Добавить доход' : 'Добавить расход';
            return (
              <Panel key={type} variant="flat" padding="sm" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {title}
                  </h3>
                  <Button
                    type="button"
                    variant="quiet"
                    size="sm"
                    icon="plus"
                    onClick={() => addRecord(type)}
                    disabled={loading}
                  >
                    {addLabel}
                  </Button>
                </div>
                {records[type].length === 0 && (
                  <EmptyState compact>
                    {isIncome
                      ? 'Добавьте доход, чтобы привязать поступление к этому платежу.'
                      : 'Добавьте расход, чтобы контролировать связанное списание.'}
                  </EmptyState>
                )}
                <FinancialRecordInputs
                  paymentIndex={0}
                  type={type}
                  records={records[type]}
                  onUpdateRecord={updateRecord}
                  onRemoveRecord={removeRecord}
                />
              </Panel>
            );
          })}
        </Panel>
      )}

      <FormActions
        onCancel={onCancel}
        isSubmitting={loading}
        submitLabel={payment ? 'Обновить' : 'Сохранить'}
      />
    </form>
  );
}
