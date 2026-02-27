import { describe, expect, it, vi } from 'vitest';

import { fetchDeal } from '../deals';
import { request } from '../request';

vi.mock('../request', () => ({
  request: vi.fn(),
}));

describe('fetchDeal', () => {
  it('requests deal with show_closed and show_deleted flags', async () => {
    vi.mocked(request).mockResolvedValue({
      id: 'deal-1',
      title: 'Сделка 1',
      client: 'client-1',
      status: 'won',
      created_at: '2026-01-01T00:00:00Z',
      quotes: [],
      documents: [],
    });

    await fetchDeal('deal-1');

    expect(request).toHaveBeenCalledWith('/deals/deal-1/?show_closed=1&show_deleted=1&embed=none');
  });
});
