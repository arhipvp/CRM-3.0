import type { Task } from '../types';

export function markTaskAsDeleted(tasks: Task[], taskId: string, deletedAt?: string): Task[] {
  const resolvedDeletedAt = deletedAt ?? new Date().toISOString();
  return tasks.map((task) =>
    task.id === taskId ? { ...task, deletedAt: task.deletedAt ?? resolvedDeletedAt } : task,
  );
}
