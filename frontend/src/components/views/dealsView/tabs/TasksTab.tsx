import { useMemo, useState } from 'react';
import type { Deal, Task } from '../../../../types';
import { BTN_PRIMARY, BTN_SM_SECONDARY } from '../../../common/buttonStyles';
import { PANEL_MUTED_TEXT } from '../../../common/uiClassNames';
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
  const renderStatusMessage = (message: string) => (
    <div className={PANEL_MUTED_TEXT}>{message}</div>
  );

  const [showDeletedTasks, setShowDeletedTasks] = useState(false);

  const deletedTasksCount = useMemo(
    () => displayedTasks.filter((task) => Boolean(task.deletedAt)).length,
    [displayedTasks],
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
        {renderStatusMessage('Задач по сделке пока нет.')}
        <button
          type="button"
          onClick={onCreateTaskClick}
          className={`${BTN_PRIMARY} rounded-xl self-start`}
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
              className="check"
            />
            <span>Показывать удалённые</span>
            {deletedTasksCount > 0 && (
              <span className="text-[11px] text-slate-400">({deletedTasksCount})</span>
            )}
          </label>
        </div>

        <button type="button" onClick={onCreateTaskClick} className={BTN_SM_SECONDARY}>
          + Создать задачу
        </button>
      </div>

      <TaskTable
        tasks={visibleTasks}
        showDealColumn={false}
        showActions
        showClientColumn={false}
        onMarkTaskDone={onMarkTaskDone}
        onEditTask={onEditTaskClick}
        onDeleteTask={onDeleteTask}
        completingTaskIds={completingTaskIds}
        emptyMessage="Задач не найдено"
      />
    </section>
  );
};
