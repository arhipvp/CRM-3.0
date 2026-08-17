import { act, renderHook as renderHookBase } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  exportFinancialRecordsXlsx,
  fetchFinancialRecordsSummary,
  fetchFinancialRecordsWithPagination,
} from '../../../../../api';
import { useAllRecordsController } from '../useAllRecordsController';

vi.mock('../../../../../api', async () => {
  const actual = await vi.importActual<typeof import('../../../../../api')>('../../../../../api');
  return {
    ...actual,
    exportFinancialRecordsXlsx: vi.fn(),
    fetchFinancialRecordsWithPagination: vi.fn(),
    fetchFinancialRecordsSummary: vi.fn(),
  };
});

const mockedFetchFinancialRecordsWithPagination = vi.mocked(fetchFinancialRecordsWithPagination);
const mockedFetchFinancialRecordsSummary = vi.mocked(fetchFinancialRecordsSummary);
const mockedExportFinancialRecordsXlsx = vi.mocked(exportFinancialRecordsXlsx);
let routerSearch = '';

const RouterLocationMirror = ({ children }: { children: ReactNode }) => {
  routerSearch = useLocation().search;
  return children;
};

const renderHook: typeof renderHookBase = (callback, options) =>
  renderHookBase(callback, {
    wrapper: ({ children }: { children: ReactNode }) => <MemoryRouter>{children}</MemoryRouter>,
    ...options,
  });

const renderHookAtCurrentLocation: typeof renderHookBase = (callback, options) =>
  renderHookBase(callback, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <MemoryRouter initialEntries={[`${window.location.pathname}${window.location.search}`]}>
        <RouterLocationMirror>{children}</RouterLocationMirror>
      </MemoryRouter>
    ),
    ...options,
  });

const emptyPayload = {
  count: 0,
  next: null,
  previous: null,
  results: [],
};

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
    routerSearch = '';
    mockedFetchFinancialRecordsWithPagination.mockReset();
    mockedFetchFinancialRecordsSummary.mockReset();
    mockedExportFinancialRecordsXlsx.mockReset();
    mockedFetchFinancialRecordsSummary.mockResolvedValue({
      recordsCount: 0,
      incomeTotal: 0,
      expenseTotal: 0,
      netTotal: 0,
      unpaidRecordsCount: 0,
      withoutStatementCount: 0,
      paymentsPaidBalanceTotal: 0,
    });
    window.history.replaceState(null, '', '/');
  });

  it('does not load records until all-records mode is active', async () => {
    renderHook(() =>
      useAllRecordsController({
        viewMode: 'statements',
        statementsById: new Map(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedFetchFinancialRecordsWithPagination).not.toHaveBeenCalled();
  });

  it('reuses the first all-records page when switching tabs without filter changes', async () => {
    mockedFetchFinancialRecordsWithPagination.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'record-1',
          payment: 'payment-1',
          amount: '100',
          record_type: 'income',
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      ],
    } as never);

    const { rerender } = renderHook(
      ({ viewMode }: { viewMode: 'all' | 'statements' }) =>
        useAllRecordsController({
          viewMode,
          statementsById: new Map(),
        }),
      { initialProps: { viewMode: 'all' } },
    );

    await act(async () => {
      await Promise.resolve();
    });

    rerender({ viewMode: 'statements' });
    rerender({ viewMode: 'all' });

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockedFetchFinancialRecordsWithPagination).toHaveBeenCalledTimes(1);
  });

  it('does not apply typed search until search is submitted', async () => {
    mockedFetchFinancialRecordsWithPagination.mockResolvedValue(emptyPayload as never);

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
      result.current.setAllRecordsSearchInput('гриша');
      await Promise.resolve();
    });

    expect(mockedFetchFinancialRecordsWithPagination).toHaveBeenCalledTimes(1);
    expect(mockedFetchFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1 }),
      expect.any(Object),
    );
    expect(mockedFetchFinancialRecordsWithPagination).not.toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'гриша' }),
      expect.any(Object),
    );
  });

  it('applies submitted search to server filters', async () => {
    mockedFetchFinancialRecordsWithPagination.mockResolvedValue(emptyPayload as never);

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
      result.current.applyAllRecordsSearch('гриша');
      await new Promise((resolve) => setTimeout(resolve, 1));
    });

    expect(mockedFetchFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, search: 'гриша' }),
      expect.any(Object),
    );
  });

  it('keeps applied search when records are refreshed', async () => {
    mockedFetchFinancialRecordsWithPagination.mockResolvedValue(emptyPayload as never);

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
      result.current.applyAllRecordsSearch('гриша');
      await Promise.resolve();
    });

    await act(async () => {
      await result.current.loadAllRecords('reset');
    });

    expect(mockedFetchFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 1, search: 'гриша' }),
      expect.any(Object),
    );
  });

  it('sends selected sales channels, payment date range, and payment date ordering to server filters', async () => {
    mockedFetchFinancialRecordsWithPagination.mockResolvedValue(emptyPayload as never);

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
      result.current.setSalesChannelFilter(['channel-1', 'channel-2']);
      result.current.setPaymentScheduledDateFrom('2026-03-01');
      result.current.setPaymentScheduledDateTo('2026-03-31');
      result.current.toggleAllRecordsSort('paymentDate');
      await new Promise((resolve) => setTimeout(resolve, 1));
    });

    expect(mockedFetchFinancialRecordsWithPagination).toHaveBeenLastCalledWith(
      expect.objectContaining({
        page: 1,
        sales_channel_ids: 'channel-1,channel-2',
        payment_scheduled_date_from: '2026-03-01',
        payment_scheduled_date_to: '2026-03-31',
        ordering: 'payment_scheduled_date_is_null,payment_scheduled_date,-created_at',
      }),
      expect.any(Object),
    );
  });

  it('reads and writes sales channel ids as CSV in the URL and clears them on reset', async () => {
    window.history.replaceState(null, '', '/?fr_sales_channel=channel-1,channel-2,channel-1');
    mockedFetchFinancialRecordsWithPagination.mockResolvedValue(emptyPayload as never);

    const { result } = renderHookAtCurrentLocation(() =>
      useAllRecordsController({
        viewMode: 'all',
        statementsById: new Map(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.salesChannelFilter).toEqual(['channel-1', 'channel-2']);

    await act(async () => {
      result.current.setSalesChannelFilter(['channel-2', 'channel-3']);
      await Promise.resolve();
    });

    expect(routerSearch).toContain('fr_sales_channel=channel-2%2Cchannel-3');

    await act(async () => {
      result.current.resetAllRecordsFilters();
      await Promise.resolve();
    });

    expect(result.current.salesChannelFilter).toEqual([]);
    expect(routerSearch).not.toContain('fr_sales_channel');
  });

  it('uses selected sales channels for XLSX export', async () => {
    mockedFetchFinancialRecordsWithPagination.mockResolvedValue(emptyPayload as never);
    mockedExportFinancialRecordsXlsx.mockResolvedValue({} as never);

    const { result } = renderHook(() =>
      useAllRecordsController({
        viewMode: 'all',
        statementsById: new Map(),
      }),
    );

    await act(async () => {
      await Promise.resolve();
      result.current.setSalesChannelFilter(['channel-1', 'channel-2']);
    });
    await act(async () => {
      await result.current.exportAllRecords();
    });

    expect(mockedExportFinancialRecordsXlsx).toHaveBeenCalledWith({
      sales_channel_ids: 'channel-1,channel-2',
    });
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
      result.current.applyAllRecordsSearch('старый');
    });

    await act(async () => {
      result.current.applyAllRecordsSearch('новый');
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
      result.current.applyAllRecordsSearch('новый');
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
