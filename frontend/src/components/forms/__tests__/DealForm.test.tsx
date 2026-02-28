import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Client, User } from '../../../types';
import { DealForm } from '../DealForm';

const makeClient = (id: string, name: string): Client => ({
  id,
  name,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
});

const users: User[] = [
  {
    id: 'user-1',
    username: 'manager',
    roles: ['Admin'],
  },
];

const baseProps = {
  users,
  onSubmit: vi.fn().mockResolvedValue(undefined),
};

describe('DealForm', () => {
  it('подставляет preselected клиента в режиме редактирования', async () => {
    const onPreselectedClientConsumed = vi.fn();

    render(
      <DealForm
        {...baseProps}
        clients={[makeClient('client-1', 'Клиент 1'), makeClient('client-2', 'Клиент 2')]}
        mode="edit"
        initialValues={{ title: 'Сделка', clientId: 'client-1' }}
        preselectedClientId="client-2"
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    const clientInput = screen.getByPlaceholderText('Начните вводить имя клиента');
    await waitFor(() => expect(clientInput).toHaveValue('Клиент 2'));
    expect(onPreselectedClientConsumed).toHaveBeenCalledTimes(1);
  });

  it('вызывает onPreselectedClientConsumed только один раз для одного preselected id', async () => {
    const onPreselectedClientConsumed = vi.fn();

    const { rerender } = render(
      <DealForm
        {...baseProps}
        clients={[makeClient('client-1', 'Клиент 1')]}
        mode="edit"
        initialValues={{ title: 'Сделка', clientId: 'client-1' }}
        preselectedClientId="client-2"
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    expect(onPreselectedClientConsumed).not.toHaveBeenCalled();

    rerender(
      <DealForm
        {...baseProps}
        clients={[makeClient('client-1', 'Клиент 1'), makeClient('client-2', 'Клиент 2')]}
        mode="edit"
        initialValues={{ title: 'Сделка', clientId: 'client-1' }}
        preselectedClientId="client-2"
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    await waitFor(() => expect(onPreselectedClientConsumed).toHaveBeenCalledTimes(1));

    rerender(
      <DealForm
        {...baseProps}
        clients={[
          makeClient('client-1', 'Клиент 1'),
          makeClient('client-2', 'Клиент 2'),
          makeClient('client-3', 'Клиент 3'),
        ]}
        mode="edit"
        initialValues={{ title: 'Сделка', clientId: 'client-1' }}
        preselectedClientId="client-2"
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    expect(onPreselectedClientConsumed).toHaveBeenCalledTimes(1);
  });

  it('не откатывает вручную выбранного клиента к initial clientId при обновлении списка клиентов', async () => {
    const { rerender } = render(
      <DealForm
        {...baseProps}
        clients={[makeClient('client-1', 'Клиент 1'), makeClient('client-2', 'Клиент 2')]}
        mode="edit"
        initialValues={{ title: 'Сделка', clientId: 'client-1' }}
      />,
    );

    const clientInput = screen.getByPlaceholderText('Начните вводить имя клиента');
    fireEvent.focus(clientInput);
    fireEvent.change(clientInput, { target: { value: 'Клиент 2' } });
    fireEvent.mouseDown(await screen.findByRole('button', { name: 'Клиент 2' }));

    expect(clientInput).toHaveValue('Клиент 2');

    rerender(
      <DealForm
        {...baseProps}
        clients={[
          makeClient('client-1', 'Клиент 1'),
          makeClient('client-2', 'Клиент 2'),
          makeClient('client-3', 'Клиент 3'),
        ]}
        mode="edit"
        initialValues={{ title: 'Сделка', clientId: 'client-1' }}
      />,
    );

    expect(clientInput).toHaveValue('Клиент 2');
  });
});
