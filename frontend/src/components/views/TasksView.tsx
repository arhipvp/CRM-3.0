import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FilterParams } from '../../api';
import { DEFAULT_TASKS_API_ORDERING } from '../../api/tasks';
import type { Task, TaskPriority, User } from '../../types';
import { FilterBar } from '../FilterBar';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { BTN_SM_SECONDARY } from '../common/buttonStyles';
import { PRIORITY_LABELS, STATUS_LABELS } from '../tasks/constants';
import { TaskTable } from '../tasks/TaskTable';
import { PageHeader } from '../common/layoutPrimitives';

type TaskSortKey = 'dueAt' | 'priority' | 'createdAt' | 'priorityThenCreatedAt';

const DEFAULT_TASKS_SORTING = 'priorityThenCreatedAt';
const TASKS_PAGE_SIZE = 50;

const TASK_SORT_OPTIONS = [
  { value: DEFAULT_TASKS_SORTING, label: 'Сначала срочные, затем старые' },
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
    case 'priorityThenCreatedAt':
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

const compareTasksByPriorityThenCreatedAt = (a: Task, b: Task): number => {
  const priorityComparison = getPriorityOrder(b.priority) - getPriorityOrder(a.priority);
  if (priorityComparison !== 0) {
    return priorityComparison;
  }

  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
};

interface TasksViewProps {
  tasks: Task[];
  currentUser: User | null;
  isLoading?: boolean;
  isBackgroundRefreshing?: boolean;
  onRefreshTasks?: (options?: {
    force?: boolean;
    showDeleted?: boolean;
    activeOnly?: boolean;
    ordering?: string;
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    priority?: string;
    assignee?: string;
  }) => Promise<void>;
  page?: number;
  totalCount?: number;
  onDealSelect?: (dealId: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  tasks,
  currentUser,
  isLoading = false,
  onRefreshTasks,
  onDealSelect,
  totalCount = 0,
}) => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = useMemo<FilterParams>(
    () => ({
      ordering: searchParams.get('ordering') || DEFAULT_TASKS_SORTING,
      search: searchParams.get('search') || undefined,
      taskStatus: searchParams.get('status') || undefined,
      priority: searchParams.get('priority') || undefined,
      show_completed: searchParams.get('show_completed') === 'true' || undefined,
      show_deleted: searchParams.get('show_deleted') === 'true' || undefined,
      only_my_tasks: searchParams.get('only_my_tasks') === 'true' || undefined,
    }),
    [searchParams],
  );
  const [filters, setFilters] = useState<FilterParams>(initialFilters);
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const lastLoadKeyRef = useRef('');
  const debouncedSearch = useDebouncedValue(String(filters.search ?? '').trim(), 300);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const handleDealClick = useCallback(
    (dealId?: string) => {
      if (!dealId) {
        return;
      }
      onDealSelect?.(dealId);
      navigate(`/deals?dealId=${encodeURIComponent(dealId)}`);
    },
    [navigate, onDealSelect],
  );

  const requestTaskPage = useCallback(
    (requestedPage: number) => {
      const showDeleted = String(filters.show_deleted) === 'true';
      const showCompleted = String(filters.show_completed) === 'true';
      const selectedStatus = String(filters.taskStatus ?? '');
      const activeOnly =
        !showDeleted &&
        !showCompleted &&
        selectedStatus !== 'done' &&
        selectedStatus !== 'canceled';
      const rawOrdering = String(filters.ordering || DEFAULT_TASKS_SORTING);
      const ordering =
        rawOrdering === DEFAULT_TASKS_SORTING
          ? DEFAULT_TASKS_API_ORDERING
          : rawOrdering.replace('dueAt', 'due_at').replace('createdAt', 'created_at');
      const status = String(filters.taskStatus ?? '') || undefined;
      const priority = String(filters.priority ?? '') || undefined;
      const assignee = String(filters.only_my_tasks) === 'true' ? currentUser?.id : undefined;
      const loadKey = JSON.stringify({
        showDeleted,
        activeOnly,
        ordering,
        debouncedSearch,
        status,
        priority,
        assignee,
        page: requestedPage,
      });
      if (loadKey === lastLoadKeyRef.current) {
        return;
      }
      lastLoadKeyRef.current = loadKey;
      const refreshPromise = onRefreshTasks?.({
        force: true,
        ordering,
        showDeleted,
        activeOnly,
        page: requestedPage,
        pageSize: TASKS_PAGE_SIZE,
        search: debouncedSearch || undefined,
        status,
        priority,
        assignee,
      });
      refreshPromise?.catch(() => undefined);
    },
    [currentUser?.id, debouncedSearch, filters, onRefreshTasks],
  );

  useEffect(() => {
    requestTaskPage(requestedPage);
  }, [requestTaskPage, requestedPage]);

  const handleFilterChange = useCallback(
    (nextFilters: FilterParams) => {
      setFilters(nextFilters);
      const nextParams = new URLSearchParams();
      const mappings: Array<[string, unknown]> = [
        ['search', nextFilters.search],
        ['ordering', nextFilters.ordering],
        ['status', nextFilters.taskStatus],
        ['priority', nextFilters.priority],
        ['show_completed', nextFilters.show_completed],
        ['show_deleted', nextFilters.show_deleted],
        ['only_my_tasks', nextFilters.only_my_tasks],
      ];
      mappings.forEach(([key, value]) => {
        if (value && !(key === 'ordering' && value === DEFAULT_TASKS_SORTING)) {
          nextParams.set(key, String(value));
        }
      });
      setSearchParams(nextParams, { replace: true });
    },
    [setSearchParams],
  );

  const setRequestedPage = useCallback(
    (nextPage: number) => {
      const nextParams = new URLSearchParams(searchParams);
      if (nextPage <= 1) nextParams.delete('page');
      else nextParams.set('page', String(nextPage));
      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams],
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
    if (!showCompleted && filters.taskStatus !== 'done') {
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
      result.sort(compareTasksByPriorityThenCreatedAt);
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
    <section aria-labelledby="tasksViewHeading" className="app-page">
      <PageHeader
        titleId="tasksViewHeading"
        title="Задачи"
        description="Текущая работа, сроки и приоритеты команды"
        meta={<span>Всего: {totalCount}</span>}
      />
      <FilterBar
        onFilterChange={handleFilterChange}
        initialFilters={initialFilters}
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
      {isLoading && !tasks.length ? (
        <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
          Загружаем задачи...
        </div>
      ) : filteredTasks.length ? (
        <>
          <TaskTable tasks={filteredTasks} onDealClick={handleDealClick} />
          {totalCount > TASKS_PAGE_SIZE ? (
            <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
              <span>
                Страница {requestedPage} из {Math.ceil(totalCount / TASKS_PAGE_SIZE)} · всего{' '}
                {totalCount}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={BTN_SM_SECONDARY}
                  disabled={requestedPage <= 1 || isLoading}
                  onClick={() => setRequestedPage(requestedPage - 1)}
                >
                  Назад
                </button>
                <button
                  type="button"
                  className={BTN_SM_SECONDARY}
                  disabled={requestedPage >= Math.ceil(totalCount / TASKS_PAGE_SIZE) || isLoading}
                  onClick={() => setRequestedPage(requestedPage + 1)}
                >
                  Далее
                </button>
              </div>
            </div>
          ) : null}
        </>
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
