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
        preselectedClient={{ id: 'client-2', name: 'Клиент 2' }}
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    const clientInput = screen.getByPlaceholderText('Начните вводить имя контактного лица');
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
        preselectedClient={{ id: 'client-2', name: 'Клиент 2' }}
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    expect(onPreselectedClientConsumed).toHaveBeenCalledTimes(1);

    rerender(
      <DealForm
        {...baseProps}
        clients={[makeClient('client-1', 'Клиент 1'), makeClient('client-2', 'Клиент 2')]}
        mode="edit"
        initialValues={{ title: 'Сделка', clientId: 'client-1' }}
        preselectedClient={{ id: 'client-2', name: 'Клиент 2' }}
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
        preselectedClient={{ id: 'client-2', name: 'Клиент 2' }}
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    expect(onPreselectedClientConsumed).toHaveBeenCalledTimes(1);
  });

  it('выбирает созданного контакта после обновления справочника и отправляет его id', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onPreselectedClientConsumed = vi.fn();
    const { rerender } = render(
      <DealForm
        {...baseProps}
        clients={[makeClient('client-1', 'Существующий контакт')]}
        onSubmit={onSubmit}
        preselectedClient={{ id: 'created-client', name: 'Новый контакт' }}
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    const clientInput = screen.getByPlaceholderText('Начните вводить имя контактного лица');
    expect(clientInput).toHaveValue('Новый контакт');
    expect(onPreselectedClientConsumed).toHaveBeenCalledTimes(1);

    rerender(
      <DealForm
        {...baseProps}
        clients={[
          makeClient('created-client', 'Новый контакт'),
          makeClient('client-1', 'Существующий контакт'),
        ]}
        onSubmit={onSubmit}
        preselectedClient={{ id: 'created-client', name: 'Новый контакт' }}
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    await waitFor(() => expect(clientInput).toHaveValue('Новый контакт'));
    expect(onPreselectedClientConsumed).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByPlaceholderText('Например: КАСКО / ОСАГО'), {
      target: { value: 'Новая сделка' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Создать сделку' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'created-client' }),
      );
    });
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

    const clientInput = screen.getByPlaceholderText('Начните вводить имя контактного лица');
    fireEvent.focus(clientInput);
    fireEvent.change(clientInput, { target: { value: 'Клиент 2' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Клиент 2' }));

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

  it('не перезаписывает ручной выбор после применения созданного клиента', async () => {
    const onPreselectedClientConsumed = vi.fn();
    const { rerender } = render(
      <DealForm
        {...baseProps}
        clients={[makeClient('client-1', 'Клиент 1'), makeClient('client-2', 'Клиент 2')]}
        preselectedClient={{ id: 'created-client', name: 'Новый контакт' }}
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    const clientInput = screen.getByPlaceholderText('Начните вводить имя контактного лица');
    await waitFor(() => expect(clientInput).toHaveValue('Новый контакт'));
    rerender(
      <DealForm
        {...baseProps}
        clients={[
          makeClient('created-client', 'Новый контакт'),
          makeClient('client-1', 'Клиент 1'),
          makeClient('client-2', 'Клиент 2'),
        ]}
        onPreselectedClientConsumed={onPreselectedClientConsumed}
      />,
    );

    fireEvent.focus(clientInput);
    fireEvent.change(clientInput, { target: { value: 'Клиент 2' } });
    fireEvent.mouseDown(await screen.findByRole('option', { name: 'Клиент 2' }));
    expect(clientInput).toHaveValue('Клиент 2');
  });

  it('сохраняет исходного клиента, если его нет в компактном справочнике', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <DealForm
        {...baseProps}
        onSubmit={onSubmit}
        clients={[makeClient('client-visible', 'Видимый клиент')]}
        mode="edit"
        initialValues={{ title: 'Сделка', clientId: 'client-outside-page' }}
      />,
    );

    fireEvent.submit(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ clientId: 'client-outside-page' }),
      );
    });
  });

  it('показывает новый label и текст ошибки для контактного лица', async () => {
    render(<DealForm {...baseProps} clients={[makeClient('client-1', 'Клиент 1')]} />);

    expect(screen.getByText(/Контактное лицо/)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Например: КАСКО / ОСАГО'), {
      target: { value: 'Сделка' },
    });
    const clientInput = screen.getByPlaceholderText('Начните вводить имя контактного лица');
    fireEvent.change(clientInput, { target: { value: '' } });

    fireEvent.submit(screen.getByRole('button', { name: 'Создать сделку' }));

    await waitFor(() => {
      expect(screen.getByText('Контактное лицо обязательно.')).toBeInTheDocument();
    });
  });

  it('в режиме редактирования позволяет полностью очистить описание', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <DealForm
        {...baseProps}
        onSubmit={onSubmit}
        clients={[makeClient('client-1', 'Клиент 1')]}
        mode="edit"
        initialValues={{
          title: 'Сделка',
          clientId: 'client-1',
          description: 'Исходное описание',
        }}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Исходное описание'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '',
        }),
      );
    });
  });

  it('отправляет trimmed описание без изменений для остальных полей', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <DealForm
        {...baseProps}
        onSubmit={onSubmit}
        clients={[makeClient('client-1', 'Клиент 1')]}
        mode="edit"
        initialValues={{
          title: 'Сделка',
          clientId: 'client-1',
          description: 'Исходное описание',
        }}
      />,
    );

    fireEvent.change(screen.getByDisplayValue('Исходное описание'), {
      target: { value: '  новое описание  ' },
    });
    fireEvent.submit(screen.getByRole('button', { name: 'Сохранить' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Сделка',
          clientId: 'client-1',
          description: 'новое описание',
        }),
      );
    });
  });
});
