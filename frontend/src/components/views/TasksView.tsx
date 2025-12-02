import React, { useMemo, useState } from 'react';
import { Task, TaskPriority } from '../../types';
import { FilterBar } from '../FilterBar';
import { FilterParams } from '../../api';

import { STATUS_LABELS, PRIORITY_LABELS } from '../tasks/constants';
import { TaskTable } from '../tasks/TaskTable';

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
      <TaskTable tasks={filteredTasks} />
    </div>
  );
};
