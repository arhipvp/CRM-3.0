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
  onDealClick?: (dealId?: string) => void;
}

const DEFAULT_EMPTY_MESSAGE = '??óø ?ç‘' úø?ø‘Ø';

export const TaskTable: React.FC<TaskTableProps> = ({
  tasks,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  showDealColumn = true,
  showActions = false,
  onMarkTaskDone,
  onEditTask,
  onDeleteTask,
  completingTaskIds = [],
  onDealClick,
}) => {
  const hasActions =
    showActions && (Boolean(onMarkTaskDone) || Boolean(onEditTask) || Boolean(onDeleteTask));
  const columnCount = 10 + (showDealColumn ? 1 : 0) + (hasActions ? 1 : 0);

  const handleDelete = (taskId: string) => {
    if (!onDeleteTask) {
      return;
    }
    onDeleteTask(taskId).catch(() => undefined);
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
            <th className="px-5 py-3">Задача</th>
            <th className="px-5 py-3">Клиент</th>
            {showDealColumn && <th className="px-5 py-3">Сделка</th>}
            <th className="px-5 py-3">Статус</th>
            <th className="px-5 py-3">Приоритет</th>
            <th className="px-5 py-3">Ответственный</th>
            <th className="px-5 py-3">Срок</th>
            <th className="px-5 py-3">Напоминание</th>
            <th className="px-5 py-3">Создано</th>
            <th className="px-5 py-3">Выполнено</th>
            <th className="px-5 py-3">Удалено</th>
            {hasActions && <th className="px-5 py-3 text-right">Действия</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const completionInfoParts: string[] = [];
            if (task.status === 'done') {
              if (task.completedByName) {
                completionInfoParts.push(`-øó‘?‘<>: ${task.completedByName}`);
              } else {
                completionInfoParts.push('-ø?ç‘?‘?ç??');
              }
              if (task.completedAt) {
                completionInfoParts.push(`? ${formatDateTime(task.completedAt)}`);
              }
            }
            const completionInfo = completionInfoParts.join(' ');
            const checklistCount = task.checklist?.length ?? 0;

            return (
              <tr
                key={task.id}
                className={`border-t border-slate-100 hover:bg-slate-50 transition ${
                  task.deletedAt ? 'bg-rose-50/40' : ''
                }`}
              >
                <td className="px-5 py-4 align-top">
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                  )}
                  <div className="text-[11px] text-slate-400 mt-2 space-y-0.5">
                    {task.createdByName && (
                      <p>??‘?‘'ø?ñ>: {task.createdByName}</p>
                    )}
                    <p>Чеклист: {checklistCount}</p>
                  </div>
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {task.clientName || '—'}
                </td>
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
                      '—'
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
                  {task.assigneeName || task.assignee || '—'}
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {task.dueAt ? formatDate(task.dueAt) : '—'}
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {task.remindAt ? formatDate(task.remindAt) : '—'}
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {formatDateTime(task.createdAt)}
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {task.completedAt ? formatDateTime(task.completedAt) : '—'}
                  {completionInfo && (
                    <p className="text-[11px] text-slate-400 mt-1">{completionInfo}</p>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-600 align-top">
                  {task.deletedAt ? formatDateTime(task.deletedAt) : '—'}
                </td>
                {hasActions && (
                  <td className="px-5 py-4 text-right space-x-3 text-xs align-top">
                    {onMarkTaskDone && task.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => onMarkTaskDone(task.id)}
                        disabled={completingTaskIds.includes(task.id)}
                        className="text-emerald-600 font-semibold hover:text-emerald-800 whitespace-nowrap"
                      >
                        {completingTaskIds.includes(task.id) ? '?‘'?ç‘Øøç?...' : '???ç‘'ñ‘'‘? ?‘<õ?>?ç???ü'}
                      </button>
                    )}
                    {onEditTask && (
                      <button
                        type="button"
                        onClick={() => onEditTask(task.id)}
                        className="text-slate-400 hover:text-sky-600 whitespace-nowrap"
                      >
                        ?ú?ç?ñ‘'‘?
                      </button>
                    )}
                    {onDeleteTask && (
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="text-slate-400 hover:text-red-500 whitespace-nowrap"
                      >
                        ??ø>ñ‘'‘?
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
