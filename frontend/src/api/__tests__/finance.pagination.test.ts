import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchFinancialRecords,
  fetchFinanceStatements,
  fetchPaymentsWithPagination,
  fetchStatementFinancialRecordsWithPagination,
} from '../finance';
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

  it('fetchPaymentsWithPagination preserves the financial records inclusion parameter', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'payment-1',
          amount: '100.00',
          financial_records: [
            {
              id: 'record-1',
              payment: 'payment-1',
              amount: '25.00',
              record_type: 'Расход',
              date: null,
              created_at: '2026-03-08T00:00:00Z',
              updated_at: '2026-03-08T00:00:00Z',
            },
          ],
          created_at: '2026-03-08T00:00:00Z',
          updated_at: '2026-03-08T00:00:00Z',
        },
      ],
    });

    const result = await fetchPaymentsWithPagination({
      deal: 'deal-1',
      include_financial_records: true,
    });

    expect(request).toHaveBeenCalledWith('/payments/?deal=deal-1&include_financial_records=true');
    expect(result.results[0].financialRecords).toHaveLength(1);
    expect(result.results[0].financialRecords?.[0]).toMatchObject({
      id: 'record-1',
      paymentId: 'payment-1',
      recordType: 'Расход',
      date: null,
    });
  });

  it('maps statement payment summaries to every row of the same payment', async () => {
    vi.mocked(request).mockResolvedValueOnce({
      count: 2,
      next: null,
      previous: null,
      results: [
        {
          id: 'record-1',
          payment: 'payment-1',
          amount: '-10.00',
          created_at: '2026-08-08T00:00:00Z',
          updated_at: '2026-08-08T00:00:00Z',
        },
        {
          id: 'record-2',
          payment: 'payment-1',
          amount: '-20.00',
          created_at: '2026-08-08T00:00:00Z',
          updated_at: '2026-08-08T00:00:00Z',
        },
      ],
      payment_summaries: {
        'payment-1': {
          paid_balance: '80.00',
          paid_entries: [
            { amount: '-20.00', date: '2026-08-07' },
            { amount: '100.00', date: '2026-08-05' },
          ],
        },
      },
    });

    const result = await fetchStatementFinancialRecordsWithPagination('statement-1');

    expect(request).toHaveBeenCalledWith('/financial_records/?statement=statement-1', undefined);
    expect(result.results).toHaveLength(2);
    expect(result.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          paymentPaidBalance: '80.00',
          paymentPaidEntries: [
            { amount: '-20.00', date: '2026-08-07' },
            { amount: '100.00', date: '2026-08-05' },
          ],
        }),
      ]),
    );
    expect(result.results[1].paymentPaidEntries).toEqual(result.results[0].paymentPaidEntries);
  });
});
