import { beforeEach, describe, expect, it, vi } from 'vitest';

import { movePolicy } from '../policies';

describe('movePolicy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('posts target deal to policy move endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'policy-1',
          number: 'POL-1',
          deal: 'deal-2',
          deal_title: 'Target deal',
          is_vehicle: false,
          status: 'active',
          created_at: '2026-01-01T00:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await movePolicy('policy-1', 'deal-2');

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/policies/policy-1/move/',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ deal: 'deal-2' }),
      }),
    );
    expect(result.dealId).toBe('deal-2');
  });
});
