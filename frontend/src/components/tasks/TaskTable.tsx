import React from 'react';
import { Task } from '../../types';
import { formatDate, formatDateTime } from '../views/dealsView/helpers';
import { PRIORITY_LABELS, STATUS_LABELS } from './constants';
import { ColoredLabel } from '../common/ColoredLabel';

interface TaskTableProps {
  tasks: Task[];
  emptyMessage?: string;
  showDealColumn?: boolean;
  showActions?: boolean;
  showClientColumn?: boolean;
  showReminderColumn?: boolean;
  showDeletedColumn?: boolean;
  taskColumnClassName?: string;
  onMarkTaskDone?: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  completingTaskIds?: string[];
  onDealClick?: (dealId?: string) => void;
}

const DEFAULT_EMPTY_MESSAGE = 'Задач не найдено';

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  showDealColumn = true,
  showActions = false,
  showClientColumn = true,
  showReminderColumn = true,
  showDeletedColumn = true,
  taskColumnClassName = '',
  onMarkTaskDone,
  onEditTask,
  onDeleteTask,
  completingTaskIds = [],
  onDealClick,
}) => {
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
    1 +
    (showDeletedColumn ? 1 : 0);

  const columnCount = baseColumnCount + (hasActions ? 1 : 0);

  const taskHeaderClassName = ['px-5', 'py-3', taskColumnClassName].filter(Boolean).join(' ');
  const taskCellClassName = ['px-5', 'py-4', 'align-top', taskColumnClassName].filter(Boolean).join(' ');

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
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
          <tr>
            <th className={taskHeaderClassName}>Задача</th>
            {showClientColumn && <th className="px-5 py-3">Клиент</th>}
            {showDealColumn && <th className="px-5 py-3">Сделка</th>}
            <th className="px-5 py-3">Статус</th>
            <th className="px-5 py-3">Приоритет</th>
            <th className="px-5 py-3">Ответственный</th>
            <th className="px-5 py-3">Срок</th>
            {showReminderColumn && <th className="px-5 py-3">Напоминание</th>}
            <th className="px-5 py-3">Создано</th>
            <th className="px-5 py-3">Выполнено</th>
            {showDeletedColumn && <th className="px-5 py-3">Удалено</th>}
            {hasActions && <th className="px-5 py-3 text-right">Действия</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const isDone = task.status === 'done';
            const checklistCount = task.checklist?.length ?? 0;

            return (
              <tr
                key={task.id}
                className={`border-t border-slate-100 hover:bg-slate-50 transition ${
                  task.deletedAt ? 'bg-rose-50/40' : ''
                }`}
              >
                <td className={taskCellClassName}>
                  <p
                    className={`font-semibold ${
                      isDone ? 'text-slate-500 line-through' : 'text-slate-900'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.description && (
                    <p
                      className={`text-xs mt-1 ${
                        isDone ? 'text-slate-500 line-through' : 'text-slate-500'
                      }`}
                    >
                      {task.description}
                    </p>
                  )}
                  <div className="text-[11px] text-slate-400 mt-2 space-y-0.5">
                    {task.createdByName && (
                      <p className="leading-tight">Создал {task.createdByName}</p>
                    )}
                    <p className="leading-tight">Чеклист: {checklistCount}</p>
                  </div>
                </td>
                {showClientColumn && (
                  <td className="px-5 py-4 text-slate-600 align-top">{task.clientName || '-'}</td>
                )}
                {showDealColumn && (
                  <td className="px-5 py-4 align-top">
                    {task.dealId ? (
                      <button
                        type="button"
                        className="text-sky-600 font-semibold text-left hover:text-sky-800"
                        onClick={() => handleDealClick(task)}
                      >
                        {task.dealTitle || task.dealId}
                      </button>
                    ) : (
                      '-'
                    )}
                  </td>
                )}
                <td className="px-5 py-4 text-slate-600 align-top">
                  {STATUS_LABELS[task.status] || task.status}
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {PRIORITY_LABELS[task.priority] || task.priority}
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {task.assigneeName || task.assignee || '-'}
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {task.dueAt ? formatDate(task.dueAt) : '-'}
                </td>
                {showReminderColumn && (
                  <td className="px-5 py-4 text-slate-600 align-top">
                    {task.remindAt ? formatDate(task.remindAt) : '-'}
                  </td>
                )}
                <td className="px-5 py-4 text-slate-600 align-top">
                  {formatDateTime(task.createdAt)}
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {task.completedAt ? formatDateTime(task.completedAt) : '-'}
                  {isDone && (
                    <p className="text-[11px] text-slate-400 mt-1 flex flex-wrap items-center gap-1">
                      Выполнил{' '}
                      <ColoredLabel
                        value={task.completedByName ?? undefined}
                        fallback="—"
                        className="font-semibold text-[11px]"
                      />
                      {task.completedAt && (
                        <span className="text-[11px] text-slate-400">
                          on {formatDateTime(task.completedAt)}
                        </span>
                      )}
                    </p>
                  )}
                </td>
                {showDeletedColumn && (
                  <td className="px-5 py-4 text-slate-600 align-top">
                    {task.deletedAt ? formatDateTime(task.deletedAt) : '-'}
                  </td>
                )}
                {hasActions && (
                  <td className="px-5 py-4 text-right space-x-3 text-xs align-top">
                    {onMarkTaskDone && task.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => handleMarkDone(task.id)}
                        disabled={completingTaskIds.includes(task.id)}
                        className="text-emerald-600 font-semibold hover:text-emerald-800 whitespace-nowrap"
                        aria-label="Отметить выполненной"
                        title="Отметить выполненной"
                      >
                        {completingTaskIds.includes(task.id) ? '⏳' : '✅'}
                      </button>
                    )}
                    {onEditTask && (
                      <button
                        type="button"
                        onClick={() => onEditTask(task.id)}
                        className="text-slate-400 hover:text-sky-600 whitespace-nowrap"
                        aria-label="Редактировать"
                        title="Редактировать"
                      >
                        ✏️
                      </button>
                    )}
                    {onDeleteTask && (
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="text-slate-400 hover:text-red-500 whitespace-nowrap"
                        aria-label="Удалить"
                        title="Удалить"
                      >
                        🗑️
                      </button>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
          {!tasks.length && (
            <tr>
              <td colSpan={columnCount} className="px-5 py-6 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
