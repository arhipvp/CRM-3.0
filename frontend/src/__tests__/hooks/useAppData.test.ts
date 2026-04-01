import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_TASKS_API_ORDERING } from '../../api/tasks';
import { buildDealsCacheKey } from '../../hooks/useAppData';
import { useAppData } from '../../hooks/useAppData';
import type { FilterParams } from '../../api';
import {
  fetchClients,
  fetchDealsWithPagination,
  fetchFinancialRecords,
  fetchFinanceStatements,
  fetchPaymentsWithPagination,
  fetchSalesChannels,
  fetchTasks,
  fetchUsers,
} from '../../api';

vi.mock('../../api', () => ({
  DEFAULT_TASKS_API_ORDERING: '-priority,due_at,-created_at',
  fetchClients: vi.fn(),
  fetchDealsWithPagination: vi.fn(),
  fetchFinancialRecords: vi.fn(),
  fetchFinanceStatements: vi.fn(),
  fetchPaymentsWithPagination: vi.fn(),
  fetchSalesChannels: vi.fn(),
  fetchTasks: vi.fn(),
  fetchUsers: vi.fn(),
}));

const mockedFetchClients = vi.mocked(fetchClients);
const mockedFetchDealsWithPagination = vi.mocked(fetchDealsWithPagination);
const mockedFetchFinancialRecords = vi.mocked(fetchFinancialRecords);
const mockedFetchFinanceStatements = vi.mocked(fetchFinanceStatements);
const mockedFetchPaymentsWithPagination = vi.mocked(fetchPaymentsWithPagination);
const mockedFetchSalesChannels = vi.mocked(fetchSalesChannels);
const mockedFetchTasks = vi.mocked(fetchTasks);

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const mockedFetchUsers = vi.mocked(fetchUsers);

beforeEach(() => {
  vi.resetAllMocks();
  mockedFetchClients.mockResolvedValue([]);
  mockedFetchUsers.mockResolvedValue([]);
  mockedFetchSalesChannels.mockResolvedValue([]);
  mockedFetchDealsWithPagination.mockResolvedValue({
    count: 1,
    next: null,
    previous: null,
    results: [
      {
        id: 'deal-1',
        title: 'Deal',
        clientId: 'client-1',
        status: 'open',
        createdAt: '2026-01-01T00:00:00Z',
        quotes: [],
        documents: [],
      },
    ],
  });
  mockedFetchPaymentsWithPagination.mockResolvedValue({
    count: 0,
    next: null,
    previous: null,
    results: [],
  });
  mockedFetchFinancialRecords.mockResolvedValue([]);
  mockedFetchFinanceStatements.mockResolvedValue([]);
  mockedFetchTasks.mockResolvedValue([]);
});

describe('buildDealsCacheKey', () => {
  it('is stable across entry ordering', () => {
    const base: FilterParams = {
      ordering: 'next_contact_date',
      search: 'example',
    };
    const swapped: FilterParams = {
      search: 'example',
      ordering: 'next_contact_date',
    };
    expect(buildDealsCacheKey(base)).toBe(buildDealsCacheKey(swapped));
  });

  it('ignores undefined values when building the key', () => {
    const filtered: FilterParams = {
      ordering: 'next_contact_date',
      search: undefined,
      show_deleted: false,
    };
    const explicitlySet: FilterParams = {
      ordering: 'next_contact_date',
      show_deleted: false,
    };
    expect(buildDealsCacheKey(filtered)).toBe(buildDealsCacheKey(explicitlySet));
  });
});

describe('useAppData loading strategy', () => {
  it('loadData does not request payments/records/statements/tasks on startup', async () => {
    const { result } = renderHook(() => useAppData());

    await act(async () => {
      await result.current.loadData();
    });

    expect(mockedFetchClients).toHaveBeenCalledTimes(1);
    expect(mockedFetchUsers).toHaveBeenCalledTimes(1);
    expect(mockedFetchSalesChannels).toHaveBeenCalledTimes(1);
    expect(mockedFetchDealsWithPagination).toHaveBeenCalled();
    expect(mockedFetchPaymentsWithPagination).not.toHaveBeenCalled();
    expect(mockedFetchFinancialRecords).not.toHaveBeenCalled();
    expect(mockedFetchFinanceStatements).not.toHaveBeenCalled();
    expect(mockedFetchTasks).not.toHaveBeenCalled();
  });

  it('loads finance and tasks lazily via ensure* methods', async () => {
    const { result } = renderHook(() => useAppData());

    await act(async () => {
      await result.current.ensureCommissionsDataLoaded();
    });
    await act(async () => {
      await result.current.ensureFinanceDataLoaded();
    });
    await act(async () => {
      await result.current.ensureTasksLoaded();
    });

    await waitFor(() => {
      expect(mockedFetchPaymentsWithPagination).toHaveBeenCalledTimes(1);
      expect(mockedFetchFinancialRecords).toHaveBeenCalledTimes(1);
      expect(mockedFetchFinanceStatements).toHaveBeenCalledTimes(1);
      expect(mockedFetchTasks).toHaveBeenCalledTimes(1);
    });
    expect(mockedFetchTasks).toHaveBeenCalledWith({
      ordering: DEFAULT_TASKS_API_ORDERING,
      show_deleted: false,
    });
  });

  it('loads commissions snapshot using only statements data', async () => {
    const { result } = renderHook(() => useAppData());

    await act(async () => {
      await result.current.ensureCommissionsDataLoaded();
    });

    expect(mockedFetchFinancialRecords).not.toHaveBeenCalled();
    expect(mockedFetchFinanceStatements).toHaveBeenCalledTimes(1);
    expect(mockedFetchPaymentsWithPagination).not.toHaveBeenCalled();
    expect(result.current.hasCommissionsSnapshotLoaded).toBe(true);
  });

  it('reuses the same in-flight finance load promise', async () => {
    const paymentsDeferred = deferred<{
      count: number;
      next: string | null;
      previous: string | null;
      results: never[];
    }>();
    const recordsDeferred = deferred<never[]>();
    mockedFetchPaymentsWithPagination.mockReturnValueOnce(paymentsDeferred.promise);
    mockedFetchFinancialRecords.mockReturnValueOnce(recordsDeferred.promise);

    const { result } = renderHook(() => useAppData());

    let firstPromise: Promise<void> | undefined;
    let secondPromise: Promise<void> | undefined;

    await act(async () => {
      firstPromise = result.current.ensureFinanceDataLoaded();
      secondPromise = result.current.ensureFinanceDataLoaded();
    });

    expect(mockedFetchFinancialRecords).toHaveBeenCalledTimes(1);
    expect(mockedFetchFinanceStatements).not.toHaveBeenCalled();

    await act(async () => {
      recordsDeferred.resolve([]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockedFetchPaymentsWithPagination).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      paymentsDeferred.resolve({
        count: 0,
        next: null,
        previous: null,
        results: [],
      });
      await Promise.all([firstPromise, secondPromise]);
    });
  });

  it('does not overwrite local finance edits with a stale full reload response', async () => {
    const paymentsDeferred = deferred<{
      count: number;
      next: string | null;
      previous: string | null;
      results: Array<{
        id: string;
        amount: string;
        createdAt: string;
        updatedAt: string;
      }>;
    }>();

    mockedFetchPaymentsWithPagination.mockReturnValueOnce(paymentsDeferred.promise as never);
    mockedFetchFinancialRecords.mockResolvedValueOnce([]);
    mockedFetchFinanceStatements.mockResolvedValueOnce([]);

    const { result } = renderHook(() => useAppData());

    let financePromise: Promise<void> | undefined;
    await act(async () => {
      financePromise = result.current.ensureFinanceDataLoaded();
    });

    await act(async () => {
      result.current.updateAppData(() => ({
        payments: [
          {
            id: 'local-payment',
            amount: '777',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          } as never,
        ],
      }));
    });

    await act(async () => {
      paymentsDeferred.resolve({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 'server-payment',
            amount: '100',
            createdAt: '2026-01-02T00:00:00Z',
            updatedAt: '2026-01-02T00:00:00Z',
          },
        ],
      });
      await financePromise;
    });

    expect(result.current.dataState.payments.map((payment) => payment.id)).toEqual([
      'local-payment',
    ]);
  });

  it('retries commissions snapshot load after a stale response and marks it as loaded', async () => {
    const statementsDeferred = deferred<
      Array<{
        id: string;
        name: string;
        statementType: 'income' | 'expense';
        status: 'draft' | 'paid';
        createdAt: string;
        updatedAt: string;
      }>
    >();

    mockedFetchFinanceStatements.mockReturnValueOnce(statementsDeferred.promise as never);
    mockedFetchFinanceStatements.mockResolvedValueOnce([
      {
        id: 'server-statement',
        name: 'Повторная ведомость',
        statementType: 'income',
        status: 'draft',
        createdAt: '2026-01-03T00:00:00Z',
        updatedAt: '2026-01-03T00:00:00Z',
      } as never,
    ]);

    const { result } = renderHook(() => useAppData());

    let commissionsPromise: Promise<void> | undefined;
    await act(async () => {
      commissionsPromise = result.current.ensureCommissionsDataLoaded();
    });

    await act(async () => {
      result.current.updateAppData(() => ({
        statements: [
          {
            id: 'local-statement',
            name: 'Локальная ведомость',
            statementType: 'income',
            status: 'draft',
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          } as never,
        ],
      }));
    });

    await act(async () => {
      statementsDeferred.resolve([
        {
          id: 'stale-statement',
          name: 'Устаревшая ведомость',
          statementType: 'income',
          status: 'draft',
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockedFetchFinanceStatements).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      await commissionsPromise;
    });

    expect(result.current.hasCommissionsSnapshotLoaded).toBe(true);
    expect(result.current.dataState.statements.map((statement) => statement.id)).toEqual([
      'server-statement',
    ]);
  });

  it('preserves finance snapshot when startup load finishes after separate commissions load', async () => {
    const dealsDeferred = deferred<{
      count: number;
      next: string | null;
      previous: string | null;
      results: Array<{
        id: string;
        title: string;
        clientId: string;
        status: 'open' | 'won' | 'lost' | 'on_hold';
        createdAt: string;
        quotes: [];
        documents: [];
      }>;
    }>();
    const clientsDeferred = deferred<never[]>();
    const usersDeferred = deferred<never[]>();
    const channelsDeferred = deferred<never[]>();

    mockedFetchDealsWithPagination.mockReturnValueOnce(dealsDeferred.promise);
    mockedFetchClients.mockReturnValueOnce(clientsDeferred.promise);
    mockedFetchUsers.mockReturnValueOnce(usersDeferred.promise);
    mockedFetchSalesChannels.mockReturnValueOnce(channelsDeferred.promise);
    mockedFetchFinancialRecords.mockResolvedValueOnce([
      {
        id: 'record-1',
        paymentId: 'payment-1',
        amount: '120',
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      } as never,
    ]);
    mockedFetchFinanceStatements.mockResolvedValueOnce([
      {
        id: 'statement-1',
        name: 'Ведомость 1',
        statementType: 'income',
        status: 'draft',
        createdAt: '2026-01-02T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
      } as never,
    ]);
    mockedFetchPaymentsWithPagination.mockResolvedValueOnce({
      count: 1,
      next: null,
      previous: null,
      results: [
        {
          id: 'payment-1',
          amount: '500',
          createdAt: '2026-01-02T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        } as never,
      ],
    });

    const { result } = renderHook(() => useAppData());

    let loadPromise: Promise<void> | undefined;
    let commissionsPromise: Promise<void> | undefined;
    let financePromise: Promise<void> | undefined;

    await act(async () => {
      loadPromise = result.current.loadData();
    });

    await act(async () => {
      commissionsPromise = result.current.ensureCommissionsDataLoaded();
      await commissionsPromise;
    });

    await act(async () => {
      financePromise = result.current.ensureFinanceDataLoaded();
      await financePromise;
    });

    expect(result.current.dataState.statements.map((statement) => statement.id)).toEqual([
      'statement-1',
    ]);
    expect(result.current.dataState.financialRecords.map((record) => record.id)).toEqual([
      'record-1',
    ]);
    expect(result.current.dataState.payments.map((payment) => payment.id)).toEqual(['payment-1']);

    await act(async () => {
      dealsDeferred.resolve({
        count: 1,
        next: null,
        previous: null,
        results: [
          {
            id: 'deal-1',
            title: 'Deal',
            clientId: 'client-1',
            status: 'open',
            createdAt: '2026-01-01T00:00:00Z',
            quotes: [],
            documents: [],
          },
        ],
      });
      clientsDeferred.resolve([]);
      usersDeferred.resolve([]);
      channelsDeferred.resolve([]);
      await loadPromise;
    });

    expect(result.current.dataState.statements.map((statement) => statement.id)).toEqual([
      'statement-1',
    ]);
    expect(result.current.dataState.financialRecords.map((record) => record.id)).toEqual([
      'record-1',
    ]);
    expect(result.current.dataState.payments.map((payment) => payment.id)).toEqual(['payment-1']);
  });
});
