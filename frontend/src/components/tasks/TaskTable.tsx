import React from 'react';
import { Task } from '../../types';
import { formatDate, formatDateTime } from '../views/dealsView/helpers';
import { PRIORITY_LABELS, STATUS_LABELS } from './constants';

interface TaskTableProps {
  tasks: Task[];
  emptyMessage?: string;
  showDealColumn?: boolean;
  showActions?: boolean;
  onMarkTaskDone?: (taskId: string) => void;
  onEditTask?: (taskId: string) => void;
  onDeleteTask?: (taskId: string) => Promise<void>;
  completingTaskIds?: string[];
}

const DEFAULT_EMPTY_MESSAGE = 'Пока нет задач';

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  showDealColumn = true,
  showActions = false,
  onMarkTaskDone,
  onEditTask,
  onDeleteTask,
  completingTaskIds = [],
}) => {
  const hasActions = showActions && (onMarkTaskDone || onEditTask || onDeleteTask);
  const columnCount = 4 + (showDealColumn ? 1 : 0) + (hasActions ? 1 : 0);

  const handleDelete = (taskId: string) => {
    if (!onDeleteTask) {
      return;
    }
    onDeleteTask(taskId).catch(() => undefined);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
          <tr>
            <th className="px-5 py-3">Задача</th>
            <th className="px-5 py-3">Статус</th>
            <th className="px-5 py-3">Приоритет</th>
            {showDealColumn && <th className="px-5 py-3">Сделка</th>}
            <th className="px-5 py-3">Срок</th>
            {hasActions && <th className="px-5 py-3 text-right">Действия</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const dealTitle = task.dealTitle || '-';
            const completionInfoParts: string[] = [];
            if (task.status === 'done') {
              if (task.completedByName) {
                completionInfoParts.push(`Закрыл: ${task.completedByName}`);
              } else {
                completionInfoParts.push('Завершено');
              }
              if (task.completedAt) {
                completionInfoParts.push(`в ${formatDateTime(task.completedAt)}`);
              }
            }
            const completionInfo = completionInfoParts.join(' ');
            return (
              <tr key={task.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                  )}
                  {task.createdByName && (
                    <p className="text-[11px] text-slate-400 mt-1">Поставил: {task.createdByName}</p>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-600">{STATUS_LABELS[task.status] || task.status}</td>
                <td className="px-5 py-4 text-slate-600">
                  {PRIORITY_LABELS[task.priority] || task.priority}
                </td>
                {showDealColumn && <td className="px-5 py-4 text-slate-600">{dealTitle}</td>}
                <td className="px-5 py-4 text-slate-600">
                  {formatDate(task.dueAt)}
                  {completionInfo && (
                    <p className="text-[11px] text-slate-400 mt-1">{completionInfo}</p>
                  )}
                </td>
                {hasActions && (
                  <td className="px-5 py-4 text-right space-x-3 text-xs">
                    {onMarkTaskDone && task.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => onMarkTaskDone(task.id)}
                        disabled={completingTaskIds.includes(task.id)}
                        className="text-emerald-600 font-semibold hover:text-emerald-800 whitespace-nowrap"
                      >
                        {completingTaskIds.includes(task.id) ? 'Отмечаем...' : 'Пометить выполненной'}
                      </button>
                    )}
                    {onEditTask && (
                      <button
                        type="button"
                        onClick={() => onEditTask(task.id)}
                        className="text-slate-400 hover:text-sky-600 whitespace-nowrap"
                      >
                        Изменить
                      </button>
                    )}
                    {onDeleteTask && (
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="text-slate-400 hover:text-red-500 whitespace-nowrap"
                      >
                        Удалить
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
