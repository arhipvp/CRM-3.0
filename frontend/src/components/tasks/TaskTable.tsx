import type { Task } from '../../types';
import { ColoredLabel } from '../common/ColoredLabel';
import { formatDate, formatDateTime } from '../views/dealsView/helpers';
import { PRIORITY_LABELS, STATUS_LABELS } from './constants';

interface TaskTableProps {
  tasks: Task[];
  emptyMessage?: string;
  showDealColumn?: boolean;
  showActions?: boolean;
  showClientColumn?: boolean;
  showReminderColumn?: boolean;
  taskColumnClassName?: string;
  onMarkTaskDone?: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  completingTaskIds?: string[];
  onDealClick?: (dealId?: string) => void;
}

const DEFAULT_EMPTY_MESSAGE = 'Задач не найдено';

export function TaskTable({
  tasks,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  showDealColumn = true,
  showActions = false,
  showClientColumn = true,
  showReminderColumn = false,
  taskColumnClassName = '',
  onMarkTaskDone,
  onEditTask,
  onDeleteTask,
  completingTaskIds = [],
  onDealClick,
}: TaskTableProps) {
  const hasActions =
    showActions && (Boolean(onMarkTaskDone) || Boolean(onEditTask) || Boolean(onDeleteTask));

  const baseColumnCount =
    1 +
    (showClientColumn ? 1 : 0) +
    (showDealColumn ? 1 : 0) +
    1 +
    1 +
    1 +
    1 +
    (showReminderColumn ? 1 : 0) +
    1 +
    1;

  const columnCount = baseColumnCount + (hasActions ? 1 : 0);

  const taskHeaderClassName = [
    'border border-slate-200 px-4 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900',
    taskColumnClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const taskCellClassName = [
    'border border-slate-200 px-4 py-2 align-top',
    taskColumnClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const handleDelete = (taskId: string) => {
    if (!onDeleteTask) {
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Вы уверены, что хотите удалить задачу?')) {
      return;
    }
    onDeleteTask(taskId).catch(() => undefined);
  };

  const handleMarkDone = (taskId: string) => {
    if (!onMarkTaskDone) {
      return;
    }
    if (typeof window !== 'undefined' && !window.confirm('Отметить задачу выполненной?')) {
      return;
    }
    onMarkTaskDone(taskId);
  };

  const handleDealClick = (task: Task) => {
    if (!onDealClick || !task.dealId) {
      return;
    }
    onDealClick(task.dealId);
  };

  return (
    <div className="app-panel shadow-none overflow-hidden">
      <div className="overflow-x-auto bg-white">
        <table className="deals-table min-w-full table-fixed border-collapse text-left text-sm">
          <thead className="bg-white/90 backdrop-blur border-b border-slate-200">
            <tr>
              <th className={taskHeaderClassName}>Задача</th>
              {showClientColumn && (
                <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[160px]">
                  Клиент
                </th>
              )}
              {showDealColumn && (
                <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[200px]">
                  Сделка
                </th>
              )}
              <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[120px]">
                Статус
              </th>
              <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[120px]">
                Приоритет
              </th>
              <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[130px]">
                Ответственный
              </th>
              <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[120px]">
                Срок
              </th>
              {showReminderColumn && (
                <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[140px]">
                  Напоминание
                </th>
              )}
              <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[140px]">
                Создано
              </th>
              <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 w-[160px]">
                Выполнено
              </th>
              {hasActions && (
                <th className="border border-slate-200 px-3 py-2 text-[11px] uppercase tracking-[0.3em] text-slate-900 text-right w-[120px]">
                  Действия
                </th>
              )}
            </tr>
          </thead>

          <tbody className="bg-white">
            {tasks.map((task) => {
              const isDone = task.status === 'done';
              const checklistCount = task.checklist?.length ?? 0;

              return (
                <tr
                  key={task.id}
                  className={[
                    'transition-colors',
                    'even:bg-slate-50/40',
                    'border-l-4 border-transparent',
                    'hover:bg-slate-50/80 hover:border-sky-500',
                    task.deletedAt ? 'bg-rose-50/30 border-rose-300' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <td className={taskCellClassName}>
                    <p className={`font-semibold leading-snug ${isDone ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p
                        className={`mt-1 text-xs leading-snug ${isDone ? 'text-slate-500 line-through' : 'text-slate-500'}`}
                      >
                        {task.description}
                      </p>
                    )}
                    <div className="mt-1 space-y-0 text-[11px] text-slate-400">
                      {task.createdByName && (
                        <p className="leading-tight">Создал {task.createdByName}</p>
                      )}
                      <p className="leading-tight">Чеклист: {checklistCount}</p>
                    </div>
                  </td>

                  {showClientColumn && (
                    <td className="border border-slate-200 px-3 py-2 align-top text-xs text-slate-900">
                      {task.clientName || '-'}
                    </td>
                  )}

                  {showDealColumn && (
                    <td className="border border-slate-200 px-3 py-2 align-top text-xs">
                      {task.dealId ? (
                        <button
                          type="button"
                          className="text-left font-semibold text-sky-700 hover:text-sky-900"
                          onClick={() => handleDealClick(task)}
                        >
                          {task.dealTitle || task.dealId}
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  )}

                  <td className="border border-slate-200 px-3 py-2 align-top text-xs text-slate-700 whitespace-nowrap">
                    {STATUS_LABELS[task.status] || task.status}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 align-top text-xs text-slate-700 whitespace-nowrap">
                    {PRIORITY_LABELS[task.priority] || task.priority}
                  </td>
                  <td className="border border-slate-200 px-3 py-2 align-top text-xs text-slate-700">
                    <ColoredLabel
                      value={task.assigneeName || task.assignee || undefined}
                      fallback="-"
                      className="truncate text-xs font-semibold text-slate-600"
                    />
                  </td>
                  <td className="border border-slate-200 px-3 py-2 align-top text-xs text-slate-700 whitespace-nowrap">
                    {task.dueAt ? formatDate(task.dueAt) : '-'}
                  </td>

                  {showReminderColumn && (
                    <td className="border border-slate-200 px-3 py-2 align-top text-xs text-slate-700 whitespace-nowrap">
                      {task.remindAt ? formatDate(task.remindAt) : '-'}
                    </td>
                  )}

                  <td className="border border-slate-200 px-3 py-2 align-top text-xs text-slate-700 whitespace-nowrap">
                    {formatDateTime(task.createdAt)}
                  </td>

                  <td className="border border-slate-200 px-3 py-2 align-top text-xs text-slate-700">
                    {task.completedAt ? formatDateTime(task.completedAt) : '-'}
                    {isDone && (
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-slate-400">
                        Выполнил{' '}
                        <ColoredLabel
                          value={task.completedByName ?? undefined}
                          fallback="-"
                          className="text-[11px] font-semibold"
                        />
                        {task.completedAt && (
                          <span className="text-[11px] text-slate-400">
                            в {formatDateTime(task.completedAt)}
                          </span>
                        )}
                      </p>
                    )}
                  </td>

                  {hasActions && (
                    <td className="border border-slate-200 px-3 py-2 align-top text-right text-xs">
                      <div className="inline-flex items-center justify-end gap-2">
                        {onMarkTaskDone && task.status !== 'done' && (
                          <button
                            type="button"
                            onClick={() => handleMarkDone(task.id)}
                            disabled={completingTaskIds.includes(task.id)}
                            className="icon-btn h-8 w-8 text-emerald-700 hover:bg-emerald-50"
                            aria-label="Отметить выполненной"
                            title="Отметить выполненной"
                          >
                            {completingTaskIds.includes(task.id) ? '…' : '✓'}
                          </button>
                        )}
                        {onEditTask && (
                          <button
                            type="button"
                            onClick={() => onEditTask(task.id)}
                            className="icon-btn h-8 w-8 text-slate-600 hover:bg-slate-50 hover:text-sky-700"
                            aria-label="Редактировать"
                            title="Редактировать"
                          >
                            ✎
                          </button>
                        )}
                        {onDeleteTask && (
                          <button
                            type="button"
                            onClick={() => handleDelete(task.id)}
                            className="icon-btn h-8 w-8 text-slate-600 hover:bg-rose-50 hover:text-rose-700"
                            aria-label="Удалить"
                            title="Удалить"
                          >
                            🗑
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {!tasks.length && (
              <tr>
                <td
                  colSpan={columnCount}
                  className="border border-slate-200 px-4 py-8 text-center text-slate-600"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
