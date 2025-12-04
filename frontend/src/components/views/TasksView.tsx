import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Task, TaskPriority, User } from '../../types';
import { FilterBar } from '../FilterBar';
import { FilterParams } from '../../api';

import { STATUS_LABELS, PRIORITY_LABELS } from '../tasks/constants';
import { TaskTable } from '../tasks/TaskTable';

type TaskSortKey = 'dueAt' | 'priority' | 'createdAt';

const TASK_SORT_OPTIONS = [
  { value: '-dueAt', label: 'Due date (newest first)' },
  { value: 'dueAt', label: 'Due date (oldest first)' },
  { value: '-priority', label: 'Priority (high to low)' },
  { value: 'priority', label: 'Priority (low to high)' },
  { value: '-createdAt', label: 'Created date (latest first)' },
  { value: 'createdAt', label: 'Created date (oldest first)' },
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
  currentUser: User | null;
  onDealSelect?: (dealId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ tasks, currentUser, onDealSelect }) => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterParams>({});

  const handleDealClick = useCallback(
    (dealId?: string) => {
      if (!dealId) {
        return;
      }
      onDealSelect?.(dealId);
      navigate('/deals');
    },
    [navigate, onDealSelect]
  );

  const filteredTasks = useMemo(() => {
    let result = [...tasks];
    const currentUserId = currentUser?.id;

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

    if (filters.show_completed !== 'true') {
      result = result.filter((task) => task.status !== 'done');
    }

    if (filters.show_deleted !== 'true') {
      result = result.filter((task) => !task.deletedAt);
    }

    if (filters.only_my_tasks === 'true') {
      result = result.filter((task) => (currentUserId ? task.assignee === currentUserId : false));
    }

    const ordering = (filters.ordering as string) || '-dueAt';
    const direction = ordering.startsWith('-') ? -1 : 1;
    const field = (ordering.replace(/^-/, '') as TaskSortKey) || 'dueAt';

    result.sort((a, b) => (getTaskSortValue(a, field) - getTaskSortValue(b, field)) * direction);
    return result;
  }, [filters, tasks, currentUser?.id]);

  return (
    <div className="space-y-4">
      <FilterBar
        onFilterChange={setFilters}
        searchPlaceholder="Search tasks, deals, or descriptions..."
        sortOptions={TASK_SORT_OPTIONS}
        customFilters={[
          {
            key: 'taskStatus',
            label: 'Status',
            type: 'select',
            options: Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'priority',
            label: 'Priority',
            type: 'select',
            options: Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label })),
          },
          {
            key: 'show_completed',
            label: 'Show completed',
            type: 'checkbox',
          },
          {
            key: 'show_deleted',
            label: 'Show deleted',
            type: 'checkbox',
          },
          {
            key: 'only_my_tasks',
            label: 'Only my tasks',
            type: 'checkbox',
          },
        ]}
      />
      <TaskTable tasks={filteredTasks} onDealClick={handleDealClick} />
    </div>
  );
};
