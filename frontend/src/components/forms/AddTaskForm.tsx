import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus, User } from '../../types';
import './AddTaskForm.css';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

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
    const preserveEmptyStrings = ['title', 'description'];
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
        throw new Error('Название задачи обязательно');
      }

      await onSubmit(formData);
    } catch (err) {
      setError(formatErrorMessage(err, 'Ошибка при сохранении задачи'));
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

      </form>
  );
}
