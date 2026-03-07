import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchFinancialRecords, fetchFinanceStatements } from '../finance';
import { request } from '../request';

vi.mock('../request', () => ({
  request: vi.fn(),
}));

describe('finance pagination', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('fetchFinancialRecords aggregates all pages', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({
        count: 3,
        next: 'http://example.test/api/v1/financial_records/?page=2',
        previous: null,
        results: [
          {
            id: 'record-1',
            payment: 'payment-1',
            amount: '10.00',
            created_at: '2026-03-08T00:00:00Z',
            updated_at: '2026-03-08T00:00:00Z',
          },
          {
            id: 'record-2',
            payment: 'payment-2',
            amount: '20.00',
            created_at: '2026-03-08T00:00:00Z',
            updated_at: '2026-03-08T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        count: 3,
        next: null,
        previous: 'http://example.test/api/v1/financial_records/?page=1',
        results: [
          {
            id: 'record-3',
            payment: 'payment-3',
            amount: '30.00',
            created_at: '2026-03-08T00:00:00Z',
            updated_at: '2026-03-08T00:00:00Z',
          },
        ],
      });

    const result = await fetchFinancialRecords();

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/financial_records/?page=1&page_size=200',
      undefined,
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/financial_records/?page=2&page_size=200',
      undefined,
    );
    expect(result.map((record) => record.id)).toEqual(['record-1', 'record-2', 'record-3']);
  });

  it('fetchFinanceStatements aggregates all pages and preserves filters', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({
        count: 2,
        next: 'http://example.test/api/v1/finance_statements/?page=2',
        previous: null,
        results: [
          {
            id: 'statement-1',
            name: 'Sheet 1',
            statement_type: 'income',
            status: 'draft',
            created_at: '2026-03-08T00:00:00Z',
            updated_at: '2026-03-08T00:00:00Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        count: 2,
        next: null,
        previous: 'http://example.test/api/v1/finance_statements/?page=1',
        results: [
          {
            id: 'statement-2',
            name: 'Sheet 2',
            statement_type: 'expense',
            status: 'paid',
            paid_at: '2026-03-07',
            created_at: '2026-03-08T00:00:00Z',
            updated_at: '2026-03-08T00:00:00Z',
          },
        ],
      });

    const options = { headers: { 'X-Test': '1' } };
    const result = await fetchFinanceStatements({ ordering: '-created_at' }, options);

    expect(request).toHaveBeenNthCalledWith(
      1,
      '/finance_statements/?ordering=-created_at&page=1&page_size=200',
      options,
    );
    expect(request).toHaveBeenNthCalledWith(
      2,
      '/finance_statements/?ordering=-created_at&page=2&page_size=200',
      options,
    );
    expect(result.map((statement) => statement.id)).toEqual(['statement-1', 'statement-2']);
  });
});
