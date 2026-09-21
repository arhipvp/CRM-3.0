import { afterEach, describe, expect, it, vi } from 'vitest';

import { request } from '../../api/request';

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts a successful empty response without attempting JSON parsing', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request<void>('/ai/documents/document-id/', { method: 'DELETE' })).resolves.toBe(
      undefined,
    );
  });
});
