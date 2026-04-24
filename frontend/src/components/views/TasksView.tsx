import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterParams } from '../../api';
import { DEFAULT_TASKS_API_ORDERING } from '../../api/tasks';
import type { Task, TaskPriority, User } from '../../types';
import { FilterBar } from '../FilterBar';
import { BTN_SM_SECONDARY } from '../common/buttonStyles';
import { PRIORITY_LABELS, STATUS_LABELS } from '../tasks/constants';
import { TaskTable } from '../tasks/TaskTable';

type TaskSortKey = 'dueAt' | 'priority' | 'createdAt' | 'priorityThenDueAt';

const DEFAULT_TASKS_SORTING = 'priorityThenDueAt';
const DEFAULT_TASKS_FILTERS: FilterParams = { ordering: DEFAULT_TASKS_SORTING };

const TASK_SORT_OPTIONS = [
  { value: DEFAULT_TASKS_SORTING, label: 'Сначала срочные, затем ближайший срок' },
  { value: '-dueAt', label: 'Срок (сначала ближние)' },
  { value: 'dueAt', label: 'Срок (сначала дальние)' },
  { value: '-priority', label: 'Приоритет (высокие сначала)' },
  { value: 'priority', label: 'Приоритет (низкие сначала)' },
  { value: '-createdAt', label: 'Дата создания (новые)' },
  { value: 'createdAt', label: 'Дата создания (старые)' },
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

const getDueAtValue = (task: Task): number => {
  if (!task.dueAt) {
    return Number.POSITIVE_INFINITY;
  }
  return new Date(task.dueAt).getTime();
};

const getTaskSortValue = (task: Task, key: TaskSortKey): number => {
  switch (key) {
    case 'priorityThenDueAt':
      return 0;
    case 'priority':
      return getPriorityOrder(task.priority);
    case 'createdAt':
      return new Date(task.createdAt).getTime();
    case 'dueAt':
    default:
      return getDueAtValue(task);
  }
};

const compareTasksByPriorityThenDueAt = (a: Task, b: Task): number => {
  const priorityComparison = getPriorityOrder(b.priority) - getPriorityOrder(a.priority);
  if (priorityComparison !== 0) {
    return priorityComparison;
  }

  const dueAtComparison = getDueAtValue(a) - getDueAtValue(b);
  if (dueAtComparison !== 0) {
    return dueAtComparison;
  }

  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
};

interface TasksViewProps {
  tasks: Task[];
  currentUser: User | null;
  isLoading?: boolean;
  isBackgroundRefreshing?: boolean;
  onRefreshTasks?: (options?: {
    force?: boolean;
    showDeleted?: boolean;
    ordering?: string;
  }) => Promise<void>;
  onDealSelect?: (dealId: string) => void;
  onDealPreview?: (dealId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  currentUser,
  isLoading = false,
  onRefreshTasks,
  onDealSelect,
  onDealPreview,
}) => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<FilterParams>(DEFAULT_TASKS_FILTERS);
  const lastShowDeletedRef = useRef(false);

  const handleDealClick = useCallback(
    (dealId?: string) => {
      if (!dealId) {
        return;
      }
      if (onDealPreview) {
        onDealPreview(dealId);
        return;
      }
      onDealSelect?.(dealId);
      navigate('/deals');
    },
    [navigate, onDealPreview, onDealSelect],
  );

  useEffect(() => {
    const showDeleted = String(filters.show_deleted) === 'true';
    if (showDeleted === lastShowDeletedRef.current) {
      return;
    }
    lastShowDeletedRef.current = showDeleted;
    onRefreshTasks?.({
      force: true,
      ordering: DEFAULT_TASKS_API_ORDERING,
      showDeleted,
    }).catch(() => undefined);
  }, [filters.show_deleted, onRefreshTasks]);

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
          task.assigneeName,
          task.assignee,
          task.createdByName,
          STATUS_LABELS[task.status] ?? task.status,
          PRIORITY_LABELS[task.priority] ?? task.priority,
          task.dueAt,
          task.remindAt,
          task.createdAt,
          task.completedAt,
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

    const showCompleted = String(filters.show_completed) === 'true';
    if (!showCompleted) {
      result = result.filter((task) => task.status !== 'done');
    }

    const showDeleted = String(filters.show_deleted) === 'true';
    if (!showDeleted) {
      result = result.filter((task) => !task.deletedAt);
    }

    const onlyMyTasks = String(filters.only_my_tasks) === 'true';
    if (onlyMyTasks) {
      result = result.filter((task) => (currentUserId ? task.assignee === currentUserId : false));
    }

    const ordering = (filters.ordering as string) || DEFAULT_TASKS_SORTING;
    if (ordering === DEFAULT_TASKS_SORTING) {
      result.sort(compareTasksByPriorityThenDueAt);
      return result;
    }

    const direction = ordering.startsWith('-') ? -1 : 1;
    const field = (ordering.replace(/^-/, '') as TaskSortKey) || 'dueAt';

    result.sort((a, b) => (getTaskSortValue(a, field) - getTaskSortValue(b, field)) * direction);
    return result;
  }, [filters, tasks, currentUser?.id]);

  const isTasksEmpty = tasks.length === 0;
  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return false;
    }
    if (key === 'ordering') {
      return value !== DEFAULT_TASKS_SORTING;
    }
    return true;
  });

  let emptyStateMessage = 'По текущим условиям задач не найдено.';
  if (isTasksEmpty) {
    emptyStateMessage = 'Пока нет задач. Создайте задачу в карточке сделки.';
  } else if (hasActiveFilters) {
    emptyStateMessage = 'По текущим фильтрам задач не найдено. Попробуйте сбросить фильтры.';
  } else {
    emptyStateMessage =
      'Активных задач не найдено (по умолчанию скрыты выполненные и удалённые). Проверьте фильтры выше.';
  }

  return (
    <section aria-labelledby="tasksViewHeading" className="app-panel p-6 shadow-none space-y-4">
      <h1 id="tasksViewHeading" className="sr-only">
        Задачи
      </h1>
      <FilterBar
        onFilterChange={setFilters}
        initialFilters={DEFAULT_TASKS_FILTERS}
        searchPlaceholder="Поиск задач, сделок или описаний..."
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
          {
            key: 'show_completed',
            label: 'Показывать выполненные',
            type: 'checkbox',
          },
          {
            key: 'show_deleted',
            label: 'Показывать удалённые',
            type: 'checkbox',
          },
          {
            key: 'only_my_tasks',
            label: 'Только мои задачи',
            type: 'checkbox',
          },
        ]}
      />
      {isLoading ? (
        <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
          Загружаем задачи...
        </div>
      ) : filteredTasks.length ? (
        <TaskTable tasks={filteredTasks} onDealClick={handleDealClick} />
      ) : (
        <div className="space-y-4">
          <div
            className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600"
            role="status"
            aria-live="polite"
          >
            <div className="mx-auto max-w-md space-y-2">
              <p className="font-semibold text-slate-900">{emptyStateMessage}</p>
              {isTasksEmpty && (
                <p>
                  Задачи создаются из карточки сделки: выберите сделку, откройте вкладку
                  &quot;Задачи&quot; и добавьте следующий шаг по клиенту.
                </p>
              )}
            </div>
          </div>
          {isTasksEmpty && (
            <div className="flex flex-wrap justify-center gap-3">
              <button type="button" onClick={() => navigate('/deals')} className={BTN_SM_SECONDARY}>
                Перейти к сделкам
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
