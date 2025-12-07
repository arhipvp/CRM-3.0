import React, { useState } from 'react';
import { Deal, Client, User } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

const formatUserLabel = (user: User) => {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.username;
};

export interface EditDealFormValues {
  title: string;
  description: string;
  clientId: string;
  nextContactDate?: string | null;
  expectedClose?: string | null;
  executorId?: string | null;
  sellerId?: string | null;
  source?: string | null;
}

interface EditDealFormProps {
  deal: Deal;
  clients: Client[];
  users: User[];
  onSubmit: (data: EditDealFormValues) => Promise<void>;
  onCancel: () => void;
  onQuickNextContactShift?: (newNextContactDate: string) => Promise<void>;
}

export function EditDealForm({
  deal,
  clients,
  users,
  onSubmit,
  onCancel,
  onQuickNextContactShift,
}: EditDealFormProps) {
  const [formData, setFormData] = useState<EditDealFormValues>({
    title: deal.title,
    description: deal.description || '',
    clientId: deal.clientId,
    nextContactDate: deal.nextContactDate,
    expectedClose: deal.expectedClose,
    executorId: deal.executor ?? null,
    sellerId: deal.seller ?? null,
    source: deal.source ?? '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isQuickSaving, setIsQuickSaving] = useState(false);

  const parseDateValue = (value?: string | null) => {
    if (!value) {
      return new Date();
    }
    const [year, month, day] = value.split('-').map((segment) => Number(segment));
    if ([year, month, day].some((value) => Number.isNaN(value))) {
      return new Date();
    }
    return new Date(year, month - 1, day);
  };

  const formatDateForInput = (value: Date) => {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const quickDateOptions = [
    { label: 'завтра', days: 1 },
    { label: '+2 дня', days: 2 },
    { label: '+5 дней', days: 5 },
  ];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    const preserveEmptyStrings = ['title', 'description', 'source'];
    const nextValue = preserveEmptyStrings.includes(name) ? value : value || null;
    setFormData((prev) => ({
      ...prev,
      [name]: nextValue,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const title = formData.title ?? '';
      if (!title.trim()) {
        throw new Error('Название сделки обязательно');
      }
      if (!formData.clientId) {
        throw new Error('Клиент обязателен');
      }

      await onSubmit(formData);
    } catch (err) {
      setError(formatErrorMessage(err, 'Ошибка при обновлении сделки'));
    } finally {
      setLoading(false);
    }
  };

  const handleQuickNextContact = async (days: number) => {
    if (loading || isQuickSaving) {
      return;
    }

    setError('');
    const currentValue = formData.nextContactDate ?? deal.nextContactDate ?? null;
    const baseDate = parseDateValue(currentValue);
    const targetDate = new Date(baseDate);
    targetDate.setDate(targetDate.getDate() + days);
    const nextDateValue = formatDateForInput(targetDate);

    setFormData((prev) => ({
      ...prev,
      nextContactDate: nextDateValue,
    }));

    if (!onQuickNextContactShift) {
      return;
    }

    setIsQuickSaving(true);
    try {
      await onQuickNextContactShift(nextDateValue);
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось обновить дату следующего контакта'));
    } finally {
      setIsQuickSaving(false);
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
        <label htmlFor="source">Источник</label>
        <input
          type="text"
          id="source"
          name="source"
          value={formData.source ?? ''}
          onChange={handleChange}
          placeholder="Источник сделки"
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

      <div className="form-group">
        <label htmlFor="sellerId">Продавец</label>
        <select
          id="sellerId"
          name="sellerId"
          value={formData.sellerId ?? ''}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="">-- Выберите продавца --</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {formatUserLabel(user)}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label htmlFor="executorId">Исполнитель</label>
        <select
          id="executorId"
          name="executorId"
          value={formData.executorId ?? ''}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="">-- Выберите исполнителя --</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.firstName || user.lastName
                ? `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim()
                : user.username}
            </option>
          ))}
        </select>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="nextContactDate">Следующий контакт</label>
          <input
            type="date"
            id="nextContactDate"
            name="nextContactDate"
            value={formData.nextContactDate || ''}
            onChange={handleChange}
            disabled={loading}
          />
          <div className="mt-2 flex flex-wrap gap-2">
            {quickDateOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleQuickNextContact(option.days)}
                disabled={loading || isQuickSaving}
                className="text-xs font-semibold rounded-full border border-slate-200 bg-slate-50 px-3 py-1 transition hover:border-slate-300 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {option.label}
              </button>
            ))}
          </div>
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
