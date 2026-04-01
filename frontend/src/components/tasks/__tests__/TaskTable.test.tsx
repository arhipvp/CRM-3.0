import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
});
