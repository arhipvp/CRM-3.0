import React, { useMemo, useState } from 'react';
import { Task, TaskPriority } from '../../types';
import { FilterBar } from '../FilterBar';
import { FilterParams } from '../../api';

const STATUS_LABELS: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Готово',
  overdue: 'Просрочено',
  canceled: 'Отменено',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Низкий',
  normal: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
};

type TaskSortKey = 'dueAt' | 'priority' | 'createdAt';

const TASK_SORT_OPTIONS = [
  { value: '-dueAt', label: 'Срок (ближайшие)' },
  { value: 'dueAt', label: 'Срок (дальние)' },
  { value: '-priority', label: 'Приоритет (высокий)' },
  { value: 'priority', label: 'Приоритет (низкий)' },
  { value: '-createdAt', label: 'Созданы недавно' },
  { value: 'createdAt', label: 'Старые задачи' },
];

const getPriorityOrder = (priority: TaskPriority): number => {
  switch (priority) {
    case 'urgent':
      return 4;
    case 'high':
      return 3;
    case 'normal':
      return 2;
    case 'low':
    default:
      return 1;
  }
};

const getTaskSortValue = (task: Task, key: TaskSortKey): number => {
  switch (key) {
    case 'priority':
      return getPriorityOrder(task.priority);
    case 'createdAt':
      return new Date(task.createdAt).getTime();
    case 'dueAt':
    default:
      return task.dueAt ? new Date(task.dueAt).getTime() : 0;
  }
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('ru-RU') : '—';

interface TasksViewProps {
  tasks: Task[];
}

export const TasksView: React.FC<TasksViewProps> = ({ tasks }) => {
  const [filters, setFilters] = useState<FilterParams>({});

  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    const search = (filters.search ?? '').toString().toLowerCase().trim();
    if (search) {
      result = result.filter((task) => {
        const haystack = [
          task.title,
          task.description,
          task.dealTitle,
          task.clientName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(search);
      });
    }

    if (filters.taskStatus) {
      result = result.filter((task) => task.status === filters.taskStatus);
    }

    if (filters.priority) {
      result = result.filter((task) => task.priority === filters.priority);
    }

    const ordering = (filters.ordering as string) || '-dueAt';
    const direction = ordering.startsWith('-') ? -1 : 1;
    const field = (ordering.replace(/^-/, '') as TaskSortKey) || 'dueAt';

    result.sort((a, b) => (getTaskSortValue(a, field) - getTaskSortValue(b, field)) * direction);
    return result;
  }, [filters, tasks]);

  return (
    <div className="space-y-4">
      <FilterBar
        onFilterChange={setFilters}
        searchPlaceholder="Поиск по задаче, сделке или описанию..."
        sortOptions={TASK_SORT_OPTIONS}
        customFilters={[
          {
            key: 'taskStatus',
            label: 'Статус',
            type: 'select',
            options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'priority',
            label: 'Приоритет',
            type: 'select',
            options: Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
          },
        ]}
      />
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
            <tr>
              <th className="px-5 py-3">Задача</th>
              <th className="px-5 py-3">Статус</th>
              <th className="px-5 py-3">Приоритет</th>
              <th className="px-5 py-3">Сделка</th>
              <th className="px-5 py-3">Дедлайн</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task) => {
              const dealTitle = task.dealTitle || '—';
              return (
                <tr key={task.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{task.title}</p>
                    {task.description && (
                      <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{STATUS_LABELS[task.status] || task.status}</td>
                  <td className="px-5 py-4 text-slate-600">{PRIORITY_LABELS[task.priority]}</td>
                  <td className="px-5 py-4 text-slate-600">{dealTitle}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(task.dueAt)}</td>
                </tr>
              );
            })}
            {!filteredTasks.length && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  Задач пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
