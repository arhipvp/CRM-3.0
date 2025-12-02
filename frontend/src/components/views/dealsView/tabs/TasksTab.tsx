import React from 'react';
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
  if (!selectedDeal) {
    return null;
  }

  if (!relatedTasks.length) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-500">There are no tasks for this deal yet.</p>
        <button
          type="button"
          onClick={onCreateTaskClick}
          className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
        >
          Create task
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-800">Tasks</h3>
        <button
          type="button"
          onClick={onCreateTaskClick}
          className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
        >
          + Add task
        </button>
      </div>
      <TaskTable
        tasks={displayedTasks}
        showDealColumn={false}
        showActions
        onMarkTaskDone={onMarkTaskDone}
        onEditTask={onEditTaskClick}
        onDeleteTask={onDeleteTask}
        completingTaskIds={completingTaskIds}
        emptyMessage="No tasks"
      />
    </div>
  );
};
