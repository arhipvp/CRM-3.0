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

export interface AddPaymentFormValues {
  policyId?: string;
  dealId?: string | null;
  amount: string;
  description?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
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
      };

      await onSubmit(submission);
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось сохранить платёж'));
    } finally {
      setLoading(false);
    }
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
          className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
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
          className="field-textarea disabled:bg-slate-50 disabled:text-slate-500"
        />
      </FormField>

      <DatesFields
        scheduledDate={formData.scheduledDate}
        actualDate={formData.actualDate}
        onChange={handleChange}
        loading={loading}
      />

      <FormActions
        onCancel={onCancel}
        isSubmitting={loading}
        submitLabel={payment ? 'Обновить' : 'Сохранить'}
      />
    </form>
  );
}
