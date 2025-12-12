import { useMemo, useState } from 'react';
import type { Deal, Task } from '../../../../types';
import { TaskTable } from '../../../tasks/TaskTable';

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
  const [showDeletedTasks, setShowDeletedTasks] = useState(false);

  const deletedTasksCount = useMemo(
    () => displayedTasks.filter((task) => Boolean(task.deletedAt)).length,
    [displayedTasks]
  );

  const visibleTasks = useMemo(() => {
    if (showDeletedTasks) {
      return displayedTasks;
    }

    return displayedTasks.filter((task) => !task.deletedAt);
  }, [displayedTasks, showDeletedTasks]);

  if (!selectedDeal) {
    return null;
  }

  if (!relatedTasks.length) {
    return (
      <section className="app-panel p-6 shadow-none space-y-4">
        <p className="text-sm text-slate-600">Задач по сделке пока нет.</p>
        <button
          type="button"
          onClick={onCreateTaskClick}
          className="btn btn-primary rounded-xl self-start"
        >
          Создать задачу
        </button>
      </section>
    );
  }

  return (
    <section className="app-panel p-6 shadow-none space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="app-label">Задачи</p>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showDeletedTasks}
              onChange={(event) => setShowDeletedTasks(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <span>Показывать удалённые</span>
            {deletedTasksCount > 0 && (
              <span className="text-[11px] text-slate-400">
                ({deletedTasksCount})
              </span>
            )}
          </label>
        </div>

        <button
          type="button"
          onClick={onCreateTaskClick}
          className="btn btn-secondary btn-sm rounded-xl"
        >
          + Создать задачу
        </button>
      </div>

      <TaskTable
        tasks={visibleTasks}
        showDealColumn={false}
        showActions
        showClientColumn={false}
        showReminderColumn={false}
        showDeletedColumn={false}
        taskColumnClassName="min-w-[360px]"
        onMarkTaskDone={onMarkTaskDone}
        onEditTask={onEditTaskClick}
        onDeleteTask={onDeleteTask}
        completingTaskIds={completingTaskIds}
        emptyMessage="Задач не найдено"
      />
    </section>
  );
};

