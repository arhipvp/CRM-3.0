import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createDealEvent, recognizeDealCalculation, updateDeal } from '../deals';

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

  it('maps detailed AI errors in calculation file results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: {},
            warnings: [],
            confidence: null,
            sources: { files: [], textIncluded: false },
            file_results: [
              {
                file_id: 'file-1',
                file_name: 'passport.jpg',
                status: 'error',
                error: {
                  code: 'ai_timeout',
                  message: 'Превышено время ожидания Polza.ai: 30 секунд.',
                  retryable: true,
                },
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    const result = await recognizeDealCalculation({
      dealId: 'deal-1',
      calculationType: 'osago',
      fileIds: ['file-1'],
      sourceText: '',
    });

    expect(result.fileResults).toEqual([
      {
        fileId: 'file-1',
        fileName: 'passport.jpg',
        status: 'error',
        confidence: null,
        message: 'Превышено время ожидания Polza.ai: 30 секунд.',
        error: {
          code: 'ai_timeout',
          message: 'Превышено время ожидания Polza.ai: 30 секунд.',
          retryable: true,
        },
      },
    ]);
  });
});
