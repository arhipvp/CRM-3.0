import { describe, expect, it } from 'vitest';

import { computeSelectedDeal } from '../../hooks/useSelectedDeal';

const createDeal = (id: string, nextContactDate: string | null, deletedAt?: string) => ({
  id,
  title: `Deal ${id}`,
  description: '',
  clientId: 'client-1',
  clientName: 'Client 1',
  status: 'open' as const,
  stageName: '',
  expectedClose: null,
  nextContactDate,
  source: '',
  lossReason: '',
  createdAt: new Date().toISOString(),
  quotes: [],
  documents: [],
  driveFolderId: null,
  deletedAt: deletedAt ?? null,
});

const clients = [
  { id: 'client-1', name: 'Client 1', createdAt: '', updatedAt: '' },
];

const users = [
  { id: 'user-seller', username: 'seller', roles: [], firstName: 'John', lastName: 'Doe' },
];

describe('computeSelectedDeal', () => {
  it('keeps deals order as provided', () => {
    const deals = [
      createDeal('d1', '2025-12-01'),
      createDeal('d2', '2025-11-01', '2025-11-02'),
      createDeal('d3', '2025-10-01'),
    ];
    const result = computeSelectedDeal({
      deals,
      clients,
      users,
      selectedDealId: null,
    });

    expect(result.sortedDeals.map((deal) => deal.id)).toEqual(['d1', 'd2', 'd3']);
    expect(result.selectedDeal?.id).toBe('d1');
  });

  it('returns selected deal by id with associated client/user', () => {
    const deals = [createDeal('d1', '2025-12-01'), createDeal('d2', '2025-11-01')];
    const result = computeSelectedDeal({
      deals,
      clients,
      users,
      selectedDealId: 'd1',
    });

    expect(result.selectedDeal?.id).toBe('d1');
    expect(result.selectedClient?.id).toBe('client-1');
  });
});
