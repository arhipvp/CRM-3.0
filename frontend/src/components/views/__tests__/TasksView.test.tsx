import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { Task } from '../../../types';
import { TasksView } from '../TasksView';

const buildTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Задача',
  description: '',
  dealId: 'deal-1',
  dealTitle: 'Сделка',
  clientName: 'Клиент',
  createdByName: 'Менеджер',
  assignee: 'user-1',
  assigneeName: 'Исполнитель',
  status: 'todo',
  priority: 'normal',
  dueAt: '2026-04-10T10:00:00Z',
  remindAt: null,
  checklist: [],
  createdAt: '2026-04-01T10:00:00Z',
  completedAt: null,
  completedByName: null,
  deletedAt: null,
  ...overrides,
});

const renderTasksView = (tasks: Task[], onRefreshTasks = vi.fn()) =>
  render(
    <MemoryRouter>
      <TasksView tasks={tasks} currentUser={null} onRefreshTasks={onRefreshTasks} />
    </MemoryRouter>,
  );

describe('TasksView', () => {
  it('sorts urgent tasks first and then by nearest due date by default', () => {
    renderTasksView([
      buildTask({
        id: 'task-high',
        title: 'Высокая',
        priority: 'high',
        dueAt: '2026-04-03T10:00:00Z',
      }),
      buildTask({
        id: 'task-urgent-later',
        title: 'Срочная позже',
        priority: 'urgent',
        dueAt: '2026-04-05T10:00:00Z',
      }),
      buildTask({
        id: 'task-urgent-sooner',
        title: 'Срочная раньше',
        priority: 'urgent',
        dueAt: '2026-04-02T10:00:00Z',
      }),
    ]);

    const titles = screen.getAllByRole('cell').map((cell) => cell.textContent ?? '');
    const combined = titles.join(' | ');

    expect(combined.indexOf('Срочная раньше')).toBeLessThan(combined.indexOf('Срочная позже'));
    expect(combined.indexOf('Срочная позже')).toBeLessThan(combined.indexOf('Высокая'));
  });

  it('keeps deleted tasks hidden by default', () => {
    renderTasksView([
      buildTask({ id: 'task-active', title: 'Активная задача' }),
      buildTask({
        id: 'task-deleted',
        title: 'Удалённая задача',
        deletedAt: '2026-04-01T10:00:00Z',
      }),
    ]);

    expect(screen.getByText('Активная задача')).toBeInTheDocument();
    expect(screen.queryByText('Удалённая задача')).not.toBeInTheDocument();
  });

  it('reloads tasks when the show deleted filter changes', async () => {
    const onRefreshTasks = vi.fn().mockResolvedValue(undefined);
    renderTasksView([buildTask()], onRefreshTasks);

    fireEvent.click(screen.getByLabelText('Показывать удалённые'));

    await waitFor(() => {
      expect(onRefreshTasks).toHaveBeenCalledWith({
        force: true,
        ordering: '-priority,due_at,-created_at',
        showDeleted: true,
      });
    });

    fireEvent.click(screen.getByLabelText('Показывать удалённые'));

    await waitFor(() => {
      expect(onRefreshTasks).toHaveBeenLastCalledWith({
        force: true,
        ordering: '-priority,due_at,-created_at',
        showDeleted: false,
      });
    });
  });

  it('explains how to create tasks from an empty state', () => {
    renderTasksView([]);

    expect(
      screen.getByText('Пока нет задач. Создайте задачу в карточке сделки.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Задачи создаются из карточки сделки/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Перейти к сделкам' })).toBeInTheDocument();
  });
});
