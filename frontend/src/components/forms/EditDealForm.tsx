import React, { useState } from 'react';
import { Deal, Client } from '../../types';

export interface EditDealFormValues {
  title: string;
  description: string;
  clientId: string;
  nextReviewDate?: string | null;
  expectedClose?: string | null;
}

interface EditDealFormProps {
  deal: Deal;
  clients: Client[];
  onSubmit: (data: EditDealFormValues) => Promise<void>;
  onCancel: () => void;
}

export function EditDealForm({ deal, clients, onSubmit, onCancel }: EditDealFormProps) {
  const [formData, setFormData] = useState<EditDealFormValues>({
    title: deal.title,
    description: deal.description || '',
    clientId: deal.clientId,
    nextReviewDate: deal.nextReviewDate,
    expectedClose: deal.expectedClose,
  });

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
      if (!formData.title.trim()) {
        throw new Error('Название сделки обязательно');
      }
      if (!formData.clientId) {
        throw new Error('Клиент обязателен');
      }

      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message || 'Ошибка при обновлении сделки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="edit-deal-form">
      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="title">Название сделки *</label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Название сделки"
          disabled={loading}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Описание</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Описание сделки"
          rows={4}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="clientId">Клиент *</label>
        <select
          id="clientId"
          name="clientId"
          value={formData.clientId}
          onChange={handleChange}
          disabled={loading}
          required
        >
          <option value="">-- Выберите клиента --</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="nextReviewDate">Следующий контакт</label>
          <input
            type="date"
            id="nextReviewDate"
            name="nextReviewDate"
            value={formData.nextReviewDate || ''}
            onChange={handleChange}
            disabled={loading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="expectedClose">Застраховать не позднее... *</label>
          <input
            type="date"
            id="expectedClose"
            name="expectedClose"
            value={formData.expectedClose || ''}
            onChange={handleChange}
            disabled={loading}
            required
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
          Отмена
        </button>
      </div>

      <style>{`
        .edit-deal-form {
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
