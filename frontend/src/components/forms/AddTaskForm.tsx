import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus, User } from '../../types';

export interface AddTaskFormValues {
  title: string;
  description?: string;
  assigneeId?: string | null;
  priority: TaskPriority;
  dueAt?: string | null;
  status?: TaskStatus;
}

interface AddTaskFormProps {
  dealId?: string;
  task?: Task;
  users: User[];
  defaultAssigneeId?: string | null;
  onSubmit: (data: AddTaskFormValues) => Promise<void>;
  onCancel: () => void;
}

export function AddTaskForm({
  task,
  users,
  defaultAssigneeId,
  onSubmit,
  onCancel,
}: AddTaskFormProps) {
  const [formData, setFormData] = useState<AddTaskFormValues>({
    title: task?.title || '',
    description: task?.description || '',
    assigneeId: task?.assignee ?? defaultAssigneeId ?? null,
    priority: task?.priority || 'normal',
    dueAt: task?.dueAt || null,
    status: task?.status || 'todo',
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
        throw new Error('Название задачи обязательно');
      }

      await onSubmit(formData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при сохранении задачи');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="add-task-form">
      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <label htmlFor="title">Название задачи *</label>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Название задачи"
          disabled={loading}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="description">Описание</label>
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          placeholder="Описание задачи"
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="form-group">
        <label htmlFor="assigneeId">Исполнитель</label>
        <select
          id="assigneeId"
          name="assigneeId"
          value={formData.assigneeId ?? ''}
          onChange={handleChange}
          disabled={loading}
        >
          <option value="">Не назначен</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>
        {!task && (
          <p className="text-xs text-slate-400 mt-1">
            По умолчанию будет назначен исполнитель сделки.
          </p>
        )}
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="priority">Приоритет</label>
          <select
            id="priority"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="low">Низкий</option>
            <option value="normal">Обычный</option>
            <option value="high">Высокий</option>
            <option value="urgent">Срочный</option>
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="dueAt">Срок выполнения</label>
          <input
            type="date"
            id="dueAt"
            name="dueAt"
            value={formData.dueAt || ''}
            onChange={handleChange}
            disabled={loading}
          />
        </div>
      </div>

      {task && (
        <div className="form-group">
          <label htmlFor="status">Статус</label>
          <select
            id="status"
            name="status"
            value={formData.status || 'todo'}
            onChange={handleChange}
            disabled={loading}
          >
            <option value="todo">К выполнению</option>
            <option value="in_progress">В работе</option>
            <option value="done">Выполнено</option>
            <option value="overdue">Просроченно</option>
            <option value="canceled">Отменено</option>
          </select>
        </div>
      )}

      <div className="form-actions">
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Сохранение...' : task ? 'Обновить' : 'Создать'}
        </button>
        <button type="button" onClick={onCancel} disabled={loading} className="btn-secondary">
          Отмена
        </button>
      </div>

      <style>{`
        .add-task-form {
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
