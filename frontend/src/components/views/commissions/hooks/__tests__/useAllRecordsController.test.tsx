import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchFinancialRecordsWithPagination } from '../../../../../api';
import { useAllRecordsController } from '../useAllRecordsController';

vi.mock('../../../../../api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../api')>('../../../../../api');
  return {
    ...actual,
    fetchFinancialRecordsWithPagination: vi.fn(),
  };
});

vi.mock('../../../../../hooks/useDebouncedValue', () => ({
  useDebouncedValue: <T,>(value: T) => value,
}));

const mockedFetchFinancialRecordsWithPagination = vi.mocked(fetchFinancialRecordsWithPagination);

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('useAllRecordsController', () => {
  beforeEach(() => {
    mockedFetchFinancialRecordsWithPagination.mockReset();
  });

  it('keeps empty search result when an older request resolves later', async () => {
    mockedFetchFinancialRecordsWithPagination.mockResolvedValueOnce({
      count: 0,
      next: null,
      previous: null,
      results: [],
    } as never);
    const oldSearchRequest = deferred<{
      count: number;
      next: string | null;
      previous: string | null;
      results: Array<Record<string, unknown>>;
    }>();
    const newSearchRequest = deferred<{
      count: number;
      next: string | null;
      previous: string | null;
      results: Array<Record<string, unknown>>;
    }>();

    mockedFetchFinancialRecordsWithPagination
      .mockReturnValueOnce(oldSearchRequest.promise as never)
      .mockReturnValueOnce(newSearchRequest.promise as never);

    const { result } = renderHook(() =>
      useAllRecordsController({
        viewMode: 'all',
        statementsById: new Map(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
      result.current.setAllRecordsSearch('старый');
    });

    await act(async () => {
      result.current.setAllRecordsSearch('новый');
    });

    await act(async () => {
      newSearchRequest.resolve({
        count: 0,
        next: null,
        previous: null,
        results: [],
      });
      await newSearchRequest.promise;
    });

    expect(result.current.allRecords).toEqual([]);
    expect(result.current.allRecordsTotalCount).toBe(0);

    await act(async () => {
      oldSearchRequest.resolve({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 'old-record',
            payment: 'payment-1',
            amount: '100',
            record_type: 'Доход',
            created_at: '2026-01-01T00:00:00Z',
            updated_at: '2026-01-01T00:00:00Z',
          },
        ],
      });
      await oldSearchRequest.promise;
    });

    expect(result.current.allRecords).toEqual([]);
    expect(result.current.allRecordsTotalCount).toBe(0);
  });

  it('does not append records from stale load-more request after search changes', async () => {
    mockedFetchFinancialRecordsWithPagination.mockResolvedValueOnce({
      count: 2,
      next: '/financial_records/?page=2',
      previous: null,
      results: [
        {
          id: 'page-1-record',
          payment: 'payment-1',
          amount: '100',
          record_type: 'Доход',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    } as never);
    const loadMoreRequest = deferred<{
      count: number;
      next: string | null;
      previous: string | null;
      results: Array<Record<string, unknown>>;
    }>();
    const newSearchRequest = deferred<{
      count: number;
      next: string | null;
      previous: string | null;
      results: Array<Record<string, unknown>>;
    }>();

    mockedFetchFinancialRecordsWithPagination
      .mockReturnValueOnce(loadMoreRequest.promise as never)
      .mockReturnValueOnce(newSearchRequest.promise as never);

    const { result } = renderHook(() =>
      useAllRecordsController({
        viewMode: 'all',
        statementsById: new Map(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      void result.current.loadAllRecords('more');
    });

    await act(async () => {
      result.current.setAllRecordsSearch('новый');
    });

    await act(async () => {
      newSearchRequest.resolve({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 'fresh-record',
            payment: 'payment-2',
            amount: '200',
            record_type: 'Доход',
            created_at: '2026-01-02T00:00:00Z',
            updated_at: '2026-01-02T00:00:00Z',
          },
        ],
      });
      await newSearchRequest.promise;
    });

    await act(async () => {
      loadMoreRequest.resolve({
        count: 2,
        next: null,
        previous: '/financial_records/?page=1',
        results: [
          {
            id: 'stale-page-2-record',
            payment: 'payment-3',
            amount: '300',
            record_type: 'Доход',
            created_at: '2026-01-03T00:00:00Z',
            updated_at: '2026-01-03T00:00:00Z',
          },
        ],
      });
      await loadMoreRequest.promise;
    });

    expect(result.current.allRecords.map((record) => record.id)).toEqual(['fresh-record']);
    expect(result.current.allRecordsHasMore).toBe(false);
  });
});
