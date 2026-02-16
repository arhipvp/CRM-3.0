import React, { useState } from 'react';
import { FinancialRecord } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { FormActions } from '../common/forms/FormActions';
import { FormError } from '../common/forms/FormError';
import { FormField } from '../common/forms/FormField';
import { FORM_INPUT_DISABLED, FORM_TEXTAREA_DISABLED } from '../common/forms/formClassNames';

export interface AddFinancialRecordFormValues {
  paymentId: string;
  recordType: 'income' | 'expense';
  amount: string;
  date?: string | null;
  description?: string;
  source?: string;
  note?: string;
}

interface AddFinancialRecordFormProps {
  paymentId: string;
  record?: FinancialRecord;
  onSubmit: (data: AddFinancialRecordFormValues) => Promise<void>;
  onCancel: () => void;
  defaultRecordType?: 'income' | 'expense';
}

const resolveRecordType = (record?: FinancialRecord): 'income' | 'expense' | undefined => {
  if (!record) {
    return undefined;
  }
  if (record.recordType === 'Расход') {
    return 'expense';
  }
  if (record.recordType === 'Доход') {
    return 'income';
  }
  const parsedAmount = parseFloat(record.amount || '');
  if (!Number.isFinite(parsedAmount)) {
    return undefined;
  }
  return parsedAmount >= 0 ? 'income' : 'expense';
};

const formatRecordTypeLabel = (type: 'income' | 'expense'): string =>
  type === 'income' ? 'Доход' : 'Расход';

const getCleanAmount = (value?: string): string => {
  if (!value) {
    return '';
  }
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? Math.abs(parsed).toString() : '';
};

export function AddFinancialRecordForm({
  paymentId,
  record,
  onSubmit,
  onCancel,
  defaultRecordType,
}: AddFinancialRecordFormProps) {
  const [formData, setFormData] = useState<AddFinancialRecordFormValues>({
    paymentId,
    recordType: resolveRecordType(record) ?? defaultRecordType ?? 'income',
    amount: record ? getCleanAmount(record.amount) : '',
    date: record?.date || '',
    description: record?.description || '',
    source: record?.source || '',
    note: record?.note || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const recordTypeLabel = formatRecordTypeLabel(formData.recordType);
  const actionLabel = record
    ? `Сохранить ${recordTypeLabel.toLowerCase()}`
    : `Добавить ${recordTypeLabel.toLowerCase()}`;
  const indicatorLabel = record ? 'Изменяете' : 'Добавляете';

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!formData.amount) {
        throw new Error('Сумма обязательна');
      }

      await onSubmit(formData);
    } catch (err) {
      setError(formatErrorMessage(err, 'Ошибка при сохранении записи'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="app-panel p-6 shadow-none space-y-6">
      <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
        {indicatorLabel} <span className="font-bold">{recordTypeLabel}</span>
      </div>
      <FormError message={error} />

      {record && (
        <div className="app-panel-muted p-4">
          <p className="app-label mb-2">Технические данные</p>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-500">ID</span>
              <span className="font-mono text-slate-700">{record.id}</span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-500">Создано</span>
              <span className="font-mono text-slate-700">{record.createdAt}</span>
            </div>
            {record.updatedAt && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-500">Обновлено</span>
                <span className="font-mono text-slate-700">{record.updatedAt}</span>
              </div>
            )}
            {record.deletedAt && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-semibold text-slate-500">Удалено</span>
                <span className="font-mono text-slate-700">{record.deletedAt}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <FormField label="Тип операции" htmlFor="recordType" required>
        <select
          id="recordType"
          name="recordType"
          value={formData.recordType}
          onChange={handleChange}
          disabled={loading}
          className={FORM_INPUT_DISABLED}
        >
          <option value="income">Доход (поступление)</option>
          <option value="expense">Расход (затраты)</option>
        </select>
      </FormField>

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
      <FormField label="Дата" htmlFor="date">
        <input
          type="date"
          id="date"
          name="date"
          value={formData.date || ''}
          onChange={handleChange}
          disabled={loading}
          className={FORM_INPUT_DISABLED}
        />
      </FormField>

      <FormField label="Примечание" htmlFor="note">
        <textarea
          id="note"
          name="note"
          value={formData.note || ''}
          onChange={handleChange}
          placeholder="Дополнительные детали"
          rows={3}
          disabled={loading}
          className={FORM_TEXTAREA_DISABLED}
        />
      </FormField>

      <FormActions onCancel={onCancel} isSubmitting={loading} submitLabel={actionLabel} />
    </form>
  );
}
