import React from 'react';
import type { Deal, Task } from '../../../types';
import { formatDate } from '../helpers';

interface TasksTabProps {
  selectedDeal: Deal | null;
  displayedTasks: Task[];
  relatedTasks: Task[];
  onCreateTaskClick: () => void;
  onEditTaskClick: (taskId: string) => void;
  onMarkTaskDone: (taskId: string) => void;
  onDeleteTask: (taskId: string) => Promise<void>;
  completingTaskIds: string[];
}

export const TasksTab: React.FC<TasksTabProps> = ({
  selectedDeal,
  displayedTasks,
  relatedTasks,
  onCreateTaskClick,
  onEditTaskClick,
  onMarkTaskDone,
  onDeleteTask,
  completingTaskIds,
}) => {
  if (!selectedDeal) {
    return null;
  }

  if (!relatedTasks.length) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">Задачи ещё не созданы.</p>
        <button
          onClick={onCreateTaskClick}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
        >
          Создать задачу
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-800">Задачи</h3>
        <button
          onClick={onCreateTaskClick}
          className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
        >
          + Новая задача
        </button>
      </div>
      <ul className="divide-y divide-slate-100">
        {displayedTasks.map((task) => (
          <li key={task.id} className="py-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p
                  className={`font-semibold text-sm ${
                    task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p
                    className={`text-sm mt-1 ${
                      task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-500'
                    }`}
                  >
                    {task.description}
                  </p>
                )}
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-4">
                  <span>Статус: {task.status}</span>
                  {task.dueAt && <span>Срок: {formatDate(task.dueAt)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {task.priority && (
                  <span className="text-xs font-semibold text-slate-500 uppercase bg-slate-100 rounded-full px-2 py-1 whitespace-nowrap">
                    {task.priority}
                  </span>
                )}
                {task.status !== 'done' && (
                  <button
                    onClick={() => onMarkTaskDone(task.id)}
                    disabled={completingTaskIds.includes(task.id)}
                    className="text-xs text-emerald-600 hover:text-emerald-800 whitespace-nowrap"
                  >
                    {completingTaskIds.includes(task.id) ? 'Сохраняю...' : 'Пометить как выполнено'}
                  </button>
                )}
                <button
                  onClick={() => onEditTaskClick(task.id)}
                  className="text-xs text-slate-400 hover:text-sky-600 whitespace-nowrap"
                >
                  Редактировать
                </button>
                <button
                  onClick={() => onDeleteTask(task.id).catch(() => undefined)}
                  className="text-xs text-slate-400 hover:text-red-500 whitespace-nowrap"
                >
                  Удалить
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
