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
