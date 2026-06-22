import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDealEvent, updateDeal } from '../deals';

describe('deal api', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });

  it('does not send expected_close on deal update', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'deal-1',
          title: 'Deal',
          client: 'client-1',
          status: 'open',
          created_at: '2026-06-17T10:00:00Z',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await updateDeal('deal-1', {
      title: 'Deal',
      clientId: 'client-1',
      expectedClose: '2026-07-01',
    });

    const [, requestOptions] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(requestOptions.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty('expected_close');
  });

  it('sends manual deadline event type when creating deal event', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'deal-event-event-1',
          deal: 'deal-1',
          event_type: 'manual_expected_close',
          event_type_display: 'Ручной крайний срок',
          event_date: '2026-07-01',
          title: 'Ручной срок',
          description: '',
          source_type: 'deal',
          source_id: 'deal-1',
          actor: null,
          actor_username: null,
          actor_display_name: null,
          metadata: {},
          created_at: '2026-06-17T10:00:00Z',
        }),
        { status: 201, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await createDealEvent('deal-1', {
      eventDate: '2026-07-01',
      reason: 'Ручной срок',
    });

    const [, requestOptions] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(requestOptions.body))).toEqual(
      expect.objectContaining({
        event_type: 'manual_expected_close',
        event_date: '2026-07-01',
        reason: 'Ручной срок',
      }),
    );
  });
});
