import type { TaskPriority, TaskStatus } from '../../types';

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'К выполнению',
  in_progress: 'В процессе',
  done: 'Завершена',
  overdue: 'Просрочена',
  canceled: 'Отменена',
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочный',
};
