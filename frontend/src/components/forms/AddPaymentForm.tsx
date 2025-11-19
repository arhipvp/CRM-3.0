import React, { useEffect, useState } from 'react';
import { Payment, Policy } from '../../types';

export interface AddPaymentFormValues {
  policyId?: string;
  dealId?: string;
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
  const hasPolicyOptions = policyOptions.length > 0;
  const fixedPolicy = fixedPolicyId
    ? policyOptions.find((policy) => policy.id === fixedPolicyId)
    : undefined;
  const fixedPolicyDisplay =
    fixedPolicy?.number ||
    fixedPolicy?.id ||
    fixedPolicyId ||
    '';
  useEffect(() => {
    if (!dealId) {
      return;
    }

    setFormData((prev) => {
      if (prev.dealId === dealId) {
        return prev;
      }
      return { ...prev, dealId };
    });
  }, [dealId]);

  useEffect(() => {
    if (!fixedPolicyId) {
      return;
    }

    setFormData((prev) =>
      prev.policyId === fixedPolicyId ? prev : { ...prev, policyId: fixedPolicyId }
    );
  }, [fixedPolicyId]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
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
        throw new Error('Сумма платежа обязательна');
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
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении платежа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-payment-form">
      {error && <div className="error-message">{error}</div>}

      {payment && (
        <div className="technical-fields">
          <div className="tech-field">
            <span className="tech-label">ID:</span>
            <span className="tech-value">{payment.id}</span>
          </div>
          <div className="tech-field">
            <span className="tech-label">Создано:</span>
            <span className="tech-value">{payment.createdAt}</span>
          </div>
          {payment.updatedAt && (
            <div className="tech-field">
              <span className="tech-label">Обновлено:</span>
              <span className="tech-value">{payment.updatedAt}</span>
            </div>
          )}
          {payment.deletedAt && (
            <div className="tech-field">
              <span className="tech-label">Удалено:</span>
              <span className="tech-value">{payment.deletedAt}</span>
            </div>
          )}
        </div>
      )}

      {fixedPolicyId ? (
        <div className="form-group">
          <label htmlFor="policyId">Полис *</label>
          <input
            type="text"
            id="policyId"
            name="policyId"
            value={fixedPolicyDisplay}
            disabled
            required
          />
          {fixedPolicy && fixedPolicy.insuranceType && (
            <p className="text-xs text-slate-500 mt-1">{fixedPolicy.insuranceType}</p>
          )}
        </div>
      ) : hasPolicyOptions ? (
        <div className="form-group">
          <label htmlFor="policyId">Полис *</label>
          <select
            id="policyId"
            name="policyId"
            value={formData.policyId || ''}
            onChange={handleChange}
            disabled={loading}
            required
          >
            <option value="">Выберите полис</option>
            {policyOptions.map((policy) => (
              <option key={policy.id} value={policy.id}>
                {policy.number || policy.id}
                {policy.insuranceType ? ` — ${policy.insuranceType}` : ''}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="form-group">
          <label htmlFor="policyId">Полис *</label>
          <input
            type="text"
            id="policyId"
            name="policyId"
            value={formData.policyId || ''}
            onChange={handleChange}
            placeholder="ID полиса"
            disabled={loading}
            required
          />
        </div>
      )}

      {dealIsFixed ? (
        <div className="form-group">
          <label htmlFor="dealId">Сделка</label>
          <input
            type="text"
            id="dealId"
            name="dealId"
            value={dealDisplayValue}
            disabled
          />
        </div>
      ) : (
        <div className="form-group">
          <label htmlFor="dealId">Сделка (опционально)</label>
          <input
            type="text"
            id="dealId"
            name="dealId"
            value={formData.dealId || ''}
            onChange={handleChange}
            placeholder="ID сделки"
            disabled={loading}
          />
        </div>
      )}

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
        <label htmlFor="description">Примечание</label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          placeholder="Примечание к платежу"
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="scheduledDate">Запланированная дата</label>
          <input
            type="date"
            id="scheduledDate"
            name="scheduledDate"
            value={formData.scheduledDate || ''}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="actualDate">Фактическая дата</label>
          <input
            type="date"
            id="actualDate"
            name="actualDate"
            value={formData.actualDate || ''}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Сохранение...' : payment ? 'Обновить' : 'Создать'}
        </button>
        <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
          Отмена
        </button>
      </div>

      <style>{`
        .add-payment-form {
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

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        @media (max-width: 640px) {
          .form-row {
            grid-template-columns: 1fr;
          }
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
