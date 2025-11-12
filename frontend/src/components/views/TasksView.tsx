import React from 'react';
import { Deal, Task } from '../../types';

const statusLabels: Record<string, string> = {
  todo: 'К выполнению',
  in_progress: 'В работе',
  done: 'Готово',
  overdue: 'Просрочено',
  canceled: 'Отменено',
};

interface TasksViewProps {
  tasks: Task[];
  deals: Deal[];
}

export const TasksView: React.FC<TasksViewProps> = ({ tasks, deals }) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
          <tr>
            <th className="px-5 py-3">Задача</th>
            <th className="px-5 py-3">Статус</th>
            <th className="px-5 py-3">Приоритет</th>
            <th className="px-5 py-3">Сделка</th>
            <th className="px-5 py-3">Дедлайн</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const deal = task.dealId ? deals.find((d) => d.id === task.dealId) : null;
            return (
              <tr key={task.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-5 py-4">
                  <p className="font-semibold text-slate-900">{task.title}</p>
                  {task.description && (
                    <p className="text-xs text-slate-500 mt-1">{task.description}</p>
                  )}
                </td>
                <td className="px-5 py-4 text-slate-600">
                  {statusLabels[task.status] || task.status}
                </td>
                <td className="px-5 py-4 text-slate-600">{task.priority}</td>
                <td className="px-5 py-4 text-slate-600">{deal?.title || '—'}</td>
                <td className="px-5 py-4 text-slate-600">
                  {task.dueAt ? new Date(task.dueAt).toLocaleDateString('ru-RU') : '—'}
                </td>
              </tr>
            );
          })}
          {!tasks.length && (
            <tr>
              <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                Задач пока нет
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};
