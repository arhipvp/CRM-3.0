import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { User } from '../../../types';
import { AddTaskForm } from '../AddTaskForm';

const users: User[] = [
  {
    id: 'user-1',
    username: 'executor',
    roles: [],
  },
  {
    id: 'user-2',
    username: 'seller',
    roles: [],
  },
];

describe('AddTaskForm', () => {
  it('не отправляет форму без ответственного', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<AddTaskForm users={users} onSubmit={onSubmit} onCancel={vi.fn()} />);

    fireEvent.change(screen.getByLabelText(/Название задачи/), {
      target: { value: 'Позвонить клиенту' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Создать' }).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText('Ответственный обязателен')).toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('отправляет задачу с ответственным из defaultAssigneeId', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <AddTaskForm
        users={users}
        defaultAssigneeId="user-1"
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/Название задачи/), {
      target: { value: 'Проверить документы' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Создать' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Проверить документы',
          assigneeId: 'user-1',
        }),
      );
    });
  });
});
