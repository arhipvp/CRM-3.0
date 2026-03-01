import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ClientsView } from '../ClientsView';
import type { Client, Deal } from '../../../types';

const buildClient = (overrides: Partial<Client> = {}): Client => ({
  id: overrides.id ?? 'client-1',
  name: overrides.name ?? 'Иван Иванов',
  phone: overrides.phone ?? '+79991112233',
  createdAt: overrides.createdAt ?? '2025-01-01T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2025-01-01T00:00:00Z',
  ...overrides,
});

const buildDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: overrides.id ?? 'deal-1',
  title: overrides.title ?? 'Сделка',
  clientId: overrides.clientId ?? 'client-1',
  status: overrides.status ?? 'open',
  createdAt: overrides.createdAt ?? '2025-01-01T00:00:00Z',
  quotes: overrides.quotes ?? [],
  documents: overrides.documents ?? [],
  ...overrides,
});

describe('ClientsView', () => {
  it('renders KPI cards and list rows', () => {
    const clients = [buildClient(), buildClient({ id: 'client-2', name: 'Петр Петров' })];
    const deals = [buildDeal(), buildDeal({ id: 'deal-2', clientId: 'client-2' })];

    render(<ClientsView clients={clients} deals={deals} />);

    expect(screen.getByText('Клиентов')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('Активных сделок')).toBeInTheDocument();
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.getByText('Петр Петров')).toBeInTheDocument();
  });

  it('filters clients by search', () => {
    render(
      <ClientsView
        clients={[buildClient(), buildClient({ id: 'client-2', name: 'Петр Петров' })]}
        deals={[buildDeal()]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Поиск по имени или телефону...'), {
      target: { value: 'Петр' },
    });

    expect(screen.queryByText('Иван Иванов')).not.toBeInTheDocument();
    expect(screen.getByText('Петр Петров')).toBeInTheDocument();
  });

  it('renders "Объединить похожих" and triggers callback', () => {
    const onClientFindSimilar = vi.fn();
    const client = buildClient();
    render(
      <ClientsView
        clients={[client]}
        deals={[buildDeal()]}
        onClientFindSimilar={onClientFindSimilar}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: `Найти похожих клиентов для ${client.name}` }),
    );
    expect(onClientFindSimilar).toHaveBeenCalledWith(client);
  });
});
