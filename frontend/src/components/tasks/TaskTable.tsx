import React from 'react';
import { Task } from '../../types';
import { formatDate } from '../views/dealsView/helpers';
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

const DEFAULT_EMPTY_MESSAGE = 'No tasks yet';

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
            <th className="px-5 py-3">Task</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Priority</th>
            {showDealColumn && <th className="px-5 py-3">Deal</th>}
            <th className="px-5 py-3">Due Date</th>
            {hasActions && <th className="px-5 py-3 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const dealTitle = task.dealTitle || '-';
            return (
              <tr key={task.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-600">{STATUS_LABELS[task.status] || task.status}</td>
                <td className="px-5 py-4 text-slate-600">
                  {PRIORITY_LABELS[task.priority] || task.priority}
                </td>
                {showDealColumn && <td className="px-5 py-4 text-slate-600">{dealTitle}</td>}
                <td className="px-5 py-4 text-slate-600">{formatDate(task.dueAt)}</td>
                {hasActions && (
                  <td className="px-5 py-4 text-right space-x-3 text-xs">
                    {onMarkTaskDone && task.status !== 'done' && (
                      <button
                        type="button"
                        onClick={() => onMarkTaskDone(task.id)}
                        disabled={completingTaskIds.includes(task.id)}
                        className="text-emerald-600 font-semibold hover:text-emerald-800 whitespace-nowrap"
                      >
                        {completingTaskIds.includes(task.id) ? 'Marking...' : 'Mark done'}
                      </button>
                    )}
                    {onEditTask && (
                      <button
                        type="button"
                        onClick={() => onEditTask(task.id)}
                        className="text-slate-400 hover:text-sky-600 whitespace-nowrap"
                      >
                        Edit
                      </button>
                    )}
                    {onDeleteTask && (
                      <button
                        type="button"
                        onClick={() => handleDelete(task.id)}
                        className="text-slate-400 hover:text-red-500 whitespace-nowrap"
                      >
                        Delete
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
