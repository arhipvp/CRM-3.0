import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
        client: 'client-1',
        status: 'open',
        created_at: '2026-01-01T00:00:00Z',
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
  });
});
