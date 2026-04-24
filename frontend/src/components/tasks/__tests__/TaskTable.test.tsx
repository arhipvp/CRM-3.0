import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TaskTable } from '../TaskTable';
import type { Task } from '../../../types';

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Срочная задача',
  description: 'Описание',
  dealId: 'deal-1',
  dealTitle: 'Сделка 1',
  clientName: 'Клиент 1',
  createdByName: 'Менеджер',
  assignee: 'user-1',
  assigneeName: 'Исполнитель',
  status: 'todo',
  priority: 'normal',
  dueAt: '2026-04-01T10:00:00Z',
  remindAt: null,
  checklist: [],
  createdAt: '2026-04-01T09:00:00Z',
  completedAt: null,
  completedByName: null,
  completionComment: '',
  deletedAt: null,
  ...overrides,
});

describe('TaskTable', () => {
  it('renders urgent task title in red', () => {
    render(<TaskTable tasks={[buildTask({ priority: 'urgent' })]} />);

    expect(screen.getByText('Срочная задача')).toHaveClass('text-rose-700');
    expect(screen.getByText('Срочная задача')).not.toHaveClass('line-through');
  });

  it('keeps non-urgent task title neutral', () => {
    render(<TaskTable tasks={[buildTask({ title: 'Обычная задача', priority: 'high' })]} />);

    expect(screen.getByText('Обычная задача')).toHaveClass('text-slate-900');
    expect(screen.getByText('Обычная задача')).not.toHaveClass('text-rose-700');
  });

  it('keeps urgent completed task title red and struck through', () => {
    render(
      <TaskTable
        tasks={[
          buildTask({
            priority: 'urgent',
            status: 'done',
            completedAt: '2026-04-01T11:00:00Z',
            completedByName: 'Исполнитель',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Срочная задача')).toHaveClass('text-rose-700');
    expect(screen.getByText('Срочная задача')).toHaveClass('line-through');
  });

  it('renders completion comment in blue for completed task', () => {
    render(
      <TaskTable
        tasks={[
          buildTask({
            status: 'done',
            completionComment: 'Посчитано в Сбер.',
            completedAt: '2026-04-01T11:00:00Z',
          }),
        ]}
      />,
    );

    expect(screen.getByText('Комментарий: Посчитано в Сбер.')).toHaveClass('text-sky-700');
  });

  it('asks for completion comment before marking task done', async () => {
    const user = userEvent.setup();
    const onMarkTaskDone = vi.fn();

    render(<TaskTable tasks={[buildTask()]} showActions onMarkTaskDone={onMarkTaskDone} />);

    await user.click(screen.getByRole('button', { name: 'Отметить выполненной' }));
    await user.type(screen.getByLabelText('Комментарий'), 'Готово, отправлено клиенту');
    await user.click(screen.getByRole('button', { name: 'Завершить' }));

    expect(onMarkTaskDone).toHaveBeenCalledWith('task-1', 'Готово, отправлено клиенту');
  });
});
