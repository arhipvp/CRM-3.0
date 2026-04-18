import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  buildLoginRedirectPath,
  consumePostLoginRedirect,
  getPostLoginRedirect,
  request,
} from '../request';

describe('request post-login redirect helpers', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
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
      'Укажите дату оплаты ведомости.',
    );
  });
});
