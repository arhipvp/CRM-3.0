import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientsView } from '../ClientsView';
import type { Client, Deal } from '../../../types';
import { fetchClientsWithPagination, fetchClientStats } from '../../../api';

vi.mock('../../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../api')>();
  return {
    ...actual,
    fetchClientsWithPagination: vi.fn(),
    fetchClientStats: vi.fn(),
  };
});

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
  beforeEach(() => {
    vi.mocked(fetchClientsWithPagination).mockReset();
    vi.mocked(fetchClientStats).mockReset();
  });

  const renderView = (ui: ReactElement, clients: Client[]) => {
    vi.mocked(fetchClientsWithPagination).mockResolvedValue({
      count: clients.length,
      next: null,
      previous: null,
      results: clients,
    });
    vi.mocked(fetchClientStats).mockResolvedValue({
      total: clients.length,
      createdLast30Days: clients.length,
    });
    return render(<MemoryRouter>{ui}</MemoryRouter>);
  };

  it('renders KPI cards and list rows', async () => {
    const clients = [buildClient(), buildClient({ id: 'client-2', name: 'Петр Петров' })];
    const deals = [buildDeal(), buildDeal({ id: 'deal-2', clientId: 'client-2' })];

    renderView(<ClientsView clients={clients} deals={deals} dealsTotalCount={42} />, clients);
    await waitFor(() => expect(fetchClientStats).toHaveBeenCalled());

    expect(screen.getByText('Клиентов')).toBeInTheDocument();
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(screen.getByText('Активных сделок')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Иван Иванов')).toBeInTheDocument();
    expect(screen.getByText('Петр Петров')).toBeInTheDocument();
  });

  it('filters clients by search', async () => {
    const user = userEvent.setup();
    const clients = [buildClient(), buildClient({ id: 'client-2', name: 'Петр Петров' })];
    renderView(<ClientsView clients={clients} deals={[buildDeal()]} />, clients);

    await waitFor(() => expect(fetchClientStats).toHaveBeenCalled());
    await user.type(screen.getByPlaceholderText('Поиск по имени или телефону...'), 'Петр');

    expect(screen.queryByText('Иван Иванов')).not.toBeInTheDocument();
    expect(screen.getByText('Петр Петров')).toBeInTheDocument();
  });

  it('renders "Объединить похожих" and triggers callback', async () => {
    const user = userEvent.setup();
    const onClientFindSimilar = vi.fn();
    const client = buildClient();
    renderView(
      <ClientsView
        clients={[client]}
        deals={[buildDeal()]}
        onClientFindSimilar={onClientFindSimilar}
      />,
      [client],
    );

    await waitFor(() => expect(fetchClientStats).toHaveBeenCalled());
    await user.click(
      screen.getByRole('button', { name: `Дополнительные действия клиента ${client.name}` }),
    );
    await user.click(screen.getByRole('button', { name: 'Объединить похожих' }));
    expect(onClientFindSimilar).toHaveBeenCalledWith(client);
  });
});
