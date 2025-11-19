import React, { useState } from 'react';
import { FinancialRecord } from '../../types';

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

export function AddFinancialRecordForm({
  paymentId,
  record,
  onSubmit,
  onCancel,
  defaultRecordType,
}: AddFinancialRecordFormProps) {
  const [formData, setFormData] = useState<AddFinancialRecordFormValues>({
    paymentId,
    recordType: record
      ? parseFloat(record.amount) >= 0
        ? 'income'
        : 'expense'
      : defaultRecordType ?? 'income',
    amount: record ? Math.abs(parseFloat(record.amount)).toString() : '',
    date: record?.date || '',
    description: record?.description || '',
    source: record?.source || '',
    note: record?.note || '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
      setError(
        err instanceof Error ? err.message : 'Ошибка при сохранении финансовой записи'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-financial-record-form">
      {error && <div className="error-message">{error}</div>}

      {record && (
        <div className="technical-fields">
          <div className="tech-field">
            <span className="tech-label">ID:</span>
            <span className="tech-value">{record.id}</span>
          </div>
          <div className="tech-field">
            <span className="tech-label">Создано:</span>
            <span className="tech-value">{record.createdAt}</span>
          </div>
          {record.updatedAt && (
            <div className="tech-field">
              <span className="tech-label">Обновлено:</span>
              <span className="tech-value">{record.updatedAt}</span>
            </div>
          )}
          {record.deletedAt && (
            <div className="tech-field">
              <span className="tech-label">Удалено:</span>
              <span className="tech-value">{record.deletedAt}</span>
            </div>
          )}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="recordType">Тип записи *</label>
        <select
          id="recordType"
          name="recordType"
          value={formData.recordType}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="income">Доход (агент получит)</option>
          <option value="expense">Расход (затраты на дела)</option>
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="amount">Сумма (руб.) *</label>
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
        />
      </div>

      <div className="form-group">
        <label htmlFor="date">Дата</label>
        <input
          type="date"
          id="date"
          name="date"
          value={formData.date || ''}
          onChange={handleChange}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Описание</label>
        <input
          type="text"
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          placeholder="Описание записи"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="source">Источник / Назначение</label>
        <input
          type="text"
          id="source"
          name="source"
          value={formData.source || ''}
          onChange={handleChange}
          placeholder="Источник дохода или назначение расхода"
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="note">Примечание</label>
        <textarea
          id="note"
          name="note"
          value={formData.note || ''}
          onChange={handleChange}
          placeholder="Дополнительные примечания"
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Сохранение...' : record ? 'Обновить' : 'Создать'}
        </button>
        <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
          Отмена
        </button>
      </div>

      <style>{`
        .add-financial-record-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 20px;
          background: white;
          border-radius: 8px;
        }

        .error-message {
          padding: 12px;
          background: #fee2e2;
          color: #991b1b;
          border-radius: 4px;
          font-size: 14px;
        }

        .technical-fields {
          padding: 12px;
          background: #f8fafc;
          border-radius: 4px;
          border-left: 3px solid #cbd5e1;
          margin-bottom: 12px;
        }

        .tech-field {
          display: flex;
          gap: 8px;
          font-size: 13px;
          margin-bottom: 6px;
        }

        .tech-field:last-child {
          margin-bottom: 0;
        }

        .tech-label {
          color: #94a3b8;
          font-weight: 500;
          min-width: 100px;
        }

        .tech-value {
          color: #475569;
          font-family: monospace;
          word-break: break-all;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
          color: #1e293b;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 4px;
          font-size: 14px;
          font-family: inherit;
        }

        .form-group input:focus,
        .form-group textarea:focus,
        .form-group select:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-group input:disabled,
        .form-group textarea:disabled,
        .form-group select:disabled {
          background: #f8fafc;
          color: #94a3b8;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          margin-top: 16px;
        }

        .btn-primary,
        .btn-secondary {
          padding: 10px 20px;
          border-radius: 4px;
          border: none;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #2563eb;
        }

        .btn-primary:disabled {
          background: #93c5fd;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: #f1f5f9;
          color: #64748b;
          border: 1px solid #e2e8f0;
        }

        .btn-secondary:hover:not(:disabled) {
          background: #e2e8f0;
        }

        .btn-secondary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </form>
  );
}
