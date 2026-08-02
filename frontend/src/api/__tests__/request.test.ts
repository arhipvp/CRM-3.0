import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  APIError,
  buildLoginRedirectPath,
  clearTokens,
  consumePostLoginRedirect,
  getAccessToken,
  getPostLoginRedirect,
  request,
  setAccessToken,
  setRefreshToken,
} from '../request';

const createJwt = (exp: number) => {
  const payload = btoa(JSON.stringify({ exp }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
  return `header.${payload}.signature`;
};

describe('request post-login redirect helpers', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    clearTokens();
    window.history.replaceState({}, '', '/deals');
    vi.restoreAllMocks();
  });

  it('reads next target from login query and clears it on consume', () => {
    window.history.replaceState({}, '', '/login?next=%2Fdeals%3FdealId%3Ddeal-1');

    expect(getPostLoginRedirect(window.location.search)).toBe('/deals?dealId=deal-1');
    expect(consumePostLoginRedirect(window.location.search)).toBe('/deals?dealId=deal-1');
    expect(window.sessionStorage.getItem('crm_post_login_redirect')).toBeNull();
  });

  it('falls back to session storage when login query is empty', () => {
    window.sessionStorage.setItem('crm_post_login_redirect', '/deals?dealId=deal-2');

    expect(getPostLoginRedirect('')).toBe('/deals?dealId=deal-2');
    expect(consumePostLoginRedirect('')).toBe('/deals?dealId=deal-2');
    expect(window.sessionStorage.getItem('crm_post_login_redirect')).toBeNull();
  });

  it('builds login redirect url with encoded next target', () => {
    expect(buildLoginRedirectPath('/deals?dealId=deal-3')).toBe(
      '/login?next=%2Fdeals%3FdealId%3Ddeal-3',
    );
    expect(buildLoginRedirectPath('/login?next=%2Fdeals')).toBe('/login');
  });

  it('keeps stored redirect intact when current path is already login', () => {
    window.sessionStorage.setItem('crm_post_login_redirect', '/deals?dealId=deal-keep');

    expect(buildLoginRedirectPath('/login?next=%2Fdeals%3FdealId%3Ddeal-keep')).toBe('/login');
    expect(window.sessionStorage.getItem('crm_post_login_redirect')).toBe(
      '/deals?dealId=deal-keep',
    );
  });
});

describe('request token refresh', () => {
  beforeEach(() => {
    clearTokens();
    vi.restoreAllMocks();
  });

  it('shares proactive refresh between concurrent requests with an expiring access token', async () => {
    const now = new Date('2027-06-16T12:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const renewedAccessToken = createJwt((now + 15 * 60 * 1000) / 1000);
    setAccessToken(createJwt((now + 10 * 1000) / 1000));
    setRefreshToken('refresh-token');

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh/')) {
        return new Response(JSON.stringify({ access: renewedAccessToken }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ url }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([request('/deals/one/'), request('/deals/two/')]);

    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/auth/refresh/')),
    ).toHaveLength(1);
    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).includes('/deals/')),
    ).toHaveLength(2);
    expect(getAccessToken()).toBe(renewedAccessToken);
  });

  it('shares one refresh when concurrent requests receive a 401 response', async () => {
    const now = new Date('2027-06-16T12:00:00Z').getTime();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const renewedAccessToken = createJwt((now + 15 * 60 * 1000) / 1000);
    setAccessToken(createJwt((now + 15 * 60 * 1000) / 1000));
    setRefreshToken('refresh-token');

    let protectedRequests = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh/')) {
        return new Response(JSON.stringify({ access: renewedAccessToken }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      protectedRequests += 1;
      if (protectedRequests <= 2) {
        return new Response(
          JSON.stringify({ detail: 'Given token not valid for any token type' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(Promise.all([request('/deals/one/'), request('/deals/two/')])).resolves.toEqual([
      { ok: true },
      { ok: true },
    ]);

    expect(
      fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/auth/refresh/')),
    ).toHaveLength(1);
  });
});

describe('request error normalization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns generic server error for html 500 payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('<!doctype html><html><body><h1>Server Error (500)</h1></body></html>', {
          status: 500,
          headers: { 'Content-Type': 'text/html' },
        }),
      ),
    );

    await expect(request('/mailboxes/')).rejects.toThrow('Ошибка сервера');
  });

  it('prefers json detail for structured api errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: 'Такой ящик уже существует.' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(request('/mailboxes/')).rejects.toThrow('Такой ящик уже существует.');
  });

  it('reads non_field_errors from DRF responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ non_field_errors: ['Нельзя удалить полис: есть оплаченные платежи.'] }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    await expect(request('/policies/policy-1/')).rejects.toThrow(
      'Нельзя удалить полис: есть оплаченные платежи.',
    );
  });

  it('reads field error arrays from DRF responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ paid_at: ['Укажите дату оплаты ведомости.'] }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(request('/finance_statements/statement-1/mark-paid/')).rejects.toThrow(
      'paid_at: Укажите дату оплаты ведомости.',
    );
  });

  it('keeps known DRF field labels in validation messages', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ deal: ['Must be a valid UUID.'] }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(request('/policies/draft/')).rejects.toThrow('Сделка: Must be a valid UUID.');
  });

  it('keeps structured error codes on api errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            detail: 'Google Drive временно не принял файл. Попробуйте ещё раз.',
            error_code: 'drive_temporary_error',
          }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    try {
      await request('/deals/deal-1/drive-files/');
      throw new Error('Expected request to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(APIError);
      expect((error as APIError).status).toBe(503);
      expect((error as APIError).errorCode).toBe('drive_temporary_error');
      expect((error as APIError).message).toBe(
        'Google Drive временно не принял файл. Попробуйте ещё раз.',
      );
    }
  });

  it('keeps multiple DRF field errors with labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            insurance_company: ['Must be a valid UUID.'],
            insurance_type: ['This field is required.'],
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );

    await expect(request('/policies/draft/')).rejects.toThrow(
      'Страховая компания: Must be a valid UUID. Тип страхования: This field is required.',
    );
  });

  it('keeps nested DRF field errors with labels', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ payments: [{ id: ['Must be a valid UUID.'] }] }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    await expect(request('/policies/draft/')).rejects.toThrow('Платежи: ID: Must be a valid UUID.');
  });
});
