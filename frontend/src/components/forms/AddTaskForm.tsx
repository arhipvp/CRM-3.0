import React, { useState } from 'react';
import { Task, TaskPriority, TaskStatus, User } from '../../types';
import { formatErrorMessage } from '../../utils/formatErrorMessage';
import { FormActions } from '../common/forms/FormActions';
import { FormError } from '../common/forms/FormError';
import { FormField } from '../common/forms/FormField';

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
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
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
    <form onSubmit={handleSubmit} className="app-panel p-6 shadow-none space-y-6">
      <FormError message={error} />

      <FormField label="Название задачи" htmlFor="title" required>
        <input
          type="text"
          id="title"
          name="title"
          value={formData.title}
          onChange={handleChange}
          placeholder="Название задачи"
          disabled={loading}
          required
          className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
        />
      </FormField>

      <FormField label="Описание" htmlFor="description">
        <textarea
          id="description"
          name="description"
          value={formData.description || ''}
          onChange={handleChange}
          placeholder="Описание задачи"
          rows={3}
          disabled={loading}
          className="field-textarea disabled:bg-slate-50 disabled:text-slate-500"
        />
      </FormField>

      <FormField
        label="Исполнитель"
        htmlFor="assigneeId"
        hint={!task ? 'По умолчанию будет назначен исполнитель сделки.' : undefined}
      >
        <select
          id="assigneeId"
          name="assigneeId"
          value={formData.assigneeId ?? ''}
          onChange={handleChange}
          disabled={loading}
          className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
        >
          <option value="">Не назначен</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.username}
            </option>
          ))}
        </select>
      </FormField>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Приоритет" htmlFor="priority">
          <select
            id="priority"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            disabled={loading}
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="low">Низкий</option>
            <option value="normal">Обычный</option>
            <option value="high">Высокий</option>
            <option value="urgent">Срочный</option>
          </select>
        </FormField>

        <FormField label="Срок выполнения" htmlFor="dueAt">
          <input
            type="date"
            id="dueAt"
            name="dueAt"
            value={formData.dueAt || ''}
            onChange={handleChange}
            disabled={loading}
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          />
        </FormField>
      </div>

      {task && (
        <FormField label="Статус" htmlFor="status">
          <select
            id="status"
            name="status"
            value={formData.status || 'todo'}
            onChange={handleChange}
            disabled={loading}
            className="field field-input disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="todo">К выполнению</option>
            <option value="in_progress">В работе</option>
            <option value="done">Выполнено</option>
            <option value="overdue">Просрочено</option>
            <option value="canceled">Отменено</option>
          </select>
        </FormField>
      )}

      <FormActions
        onCancel={onCancel}
        isSubmitting={loading}
        submitLabel={task ? 'Обновить' : 'Создать'}
      />
    </form>
  );
}
