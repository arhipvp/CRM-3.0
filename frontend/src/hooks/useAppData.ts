import { useCallback, useReducer, useRef, useState } from 'react';

import {
  fetchClients,
  fetchDealsWithPagination,
  fetchFinancialRecords,
  fetchFinanceStatements,
  fetchPaymentsWithPagination,
  fetchPoliciesWithPagination,
  fetchSalesChannels,
  fetchTasks,
  fetchUsers,
} from '../api';
import type { FilterParams } from '../api';
import type {
  Client,
  Deal,
  FinancialRecord,
  Payment,
  Policy,
  SalesChannel,
  Statement,
  Task,
  User,
} from '../types';
import { formatErrorMessage } from '../utils/formatErrorMessage';

interface AppDataState {
  clients: Client[];
  deals: Deal[];
  policies: Policy[];
  salesChannels: SalesChannel[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  statements: Statement[];
  tasks: Task[];
  users: User[];
}

const DEALS_PAGE_SIZE = 10;

const INITIAL_APP_DATA_STATE: AppDataState = {
  clients: [],
  deals: [],
  policies: [],
  salesChannels: [],
  payments: [],
  financialRecords: [],
  statements: [],
  tasks: [],
  users: [],
};

type AppDataAction =
  | { type: 'assign'; payload: Partial<AppDataState> }
  | { type: 'update'; updater: (prev: AppDataState) => Partial<AppDataState> };

const dataReducer = (state: AppDataState, action: AppDataAction): AppDataState => {
  if (action.type === 'assign') {
    return { ...state, ...action.payload };
  }
  return { ...state, ...action.updater(state) };
};

export const buildDealsCacheKey = (filters: FilterParams): string => {
  const normalized = Object.entries(filters ?? {})
    .filter(([, value]) => value !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(normalized);
};

export const useAppData = () => {
  const [dataState, dispatch] = useReducer(dataReducer, INITIAL_APP_DATA_STATE);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealsFilters, setDealsFilters] = useState<FilterParams>({ ordering: 'next_contact_date' });
  const [dealsNextPage, setDealsNextPage] = useState<number | null>(null);
  const [isLoadingMoreDeals, setIsLoadingMoreDeals] = useState(false);
  const dealsCacheRef = useRef(
    new Map<string, { results: Deal[]; nextPage: number | null }>()
  );
  const invalidateDealsCache = useCallback((filters?: FilterParams) => {
    if (filters) {
      dealsCacheRef.current.delete(buildDealsCacheKey(filters));
      return;
    }
    dealsCacheRef.current.clear();
  }, []);

  const setAppData = useCallback((payload: Partial<AppDataState>) => {
    dispatch({ type: 'assign', payload });
  }, []);

  const updateAppData = useCallback((updater: (prev: AppDataState) => Partial<AppDataState>) => {
    dispatch({ type: 'update', updater });
  }, []);

  const refreshDeals = useCallback(
    async (filters?: FilterParams, options?: { force?: boolean }) => {
      const resolvedFilters = { ordering: 'next_contact_date', ...(filters ?? {}) };
      const cacheKey = buildDealsCacheKey(resolvedFilters);
      const force = options?.force ?? false;
      if (!force) {
        const cached = dealsCacheRef.current.get(cacheKey);
        if (cached) {
          setAppData({ deals: cached.results });
          setDealsFilters(resolvedFilters);
          setDealsNextPage(cached.nextPage);
          return cached.results;
        }
      }
      const payload = await fetchDealsWithPagination({
        ...resolvedFilters,
        page: 1,
        page_size: DEALS_PAGE_SIZE,
      });
      const results = payload.results;
      const nextPage = payload.next ? 2 : null;
      dealsCacheRef.current.set(cacheKey, { results, nextPage });
      setAppData({ deals: results });
      setDealsFilters(resolvedFilters);
      setDealsNextPage(nextPage);
      return results;
    },
    [setAppData]
  );

  const loadMoreDeals = useCallback(async () => {
    if (!dealsNextPage || isLoadingMoreDeals) {
      return;
    }
    setIsLoadingMoreDeals(true);
    const cacheKey = buildDealsCacheKey(dealsFilters);
    try {
      const payload = await fetchDealsWithPagination({
        ...dealsFilters,
        page: dealsNextPage,
        page_size: DEALS_PAGE_SIZE,
      });
      updateAppData((prev) => {
        const extended = [...prev.deals, ...payload.results];
        dealsCacheRef.current.set(cacheKey, {
          results: extended,
          nextPage: payload.next ? dealsNextPage + 1 : null,
        });
        return { deals: extended };
      });
      setDealsNextPage(payload.next ? dealsNextPage + 1 : null);
    } catch (err) {
      setError(formatErrorMessage(err, 'Error loading more deals'));
    } finally {
      setIsLoadingMoreDeals(false);
    }
  }, [
    dealsFilters,
    dealsNextPage,
    isLoadingMoreDeals,
    setError,
    updateAppData,
  ]);


  const refreshPolicies = useCallback(async () => {
    const PAGE_SIZE = 200;
    let page = 1;
    const retrieved: Policy[] = [];

    while (true) {
      const payload = await fetchPoliciesWithPagination({ page, page_size: PAGE_SIZE });
      retrieved.push(...payload.results);
      if (!payload.next) {
        break;
      }
      page += 1;
    }

    setAppData({ policies: retrieved });
  }, [setAppData]);

  const fetchAllPayments = useCallback(async () => {
    const PAGE_SIZE = 200;
    let page = 1;
    const retrieved: Payment[] = [];

    while (true) {
      const payload = await fetchPaymentsWithPagination({ page, page_size: PAGE_SIZE });
      retrieved.push(...payload.results);
      if (!payload.next) {
        break;
      }
      page += 1;
    }

    return retrieved;
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dealsPromise = refreshDeals();
      const [
        clientsData,
        paymentsData,
        tasksData,
        financialRecordsData,
        usersData,
        salesChannelsData,
        statementsData,
      ] =
        await Promise.all([
          fetchClients(),
          fetchAllPayments(),
          fetchTasks({ show_deleted: true }),
          fetchFinancialRecords(),
          fetchUsers(),
          fetchSalesChannels(),
          fetchFinanceStatements(),
        ]);
      await dealsPromise;
      await refreshPolicies();
      setAppData({
        clients: clientsData,
        payments: paymentsData,
        tasks: tasksData,
        financialRecords: financialRecordsData,
        statements: statementsData,
        users: usersData,
        salesChannels: salesChannelsData,
      });
    } catch (err) {
      setError(formatErrorMessage(err, 'Ошибка при загрузке данных с backend'));
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [fetchAllPayments, refreshDeals, refreshPolicies, setAppData]);

  const dealsHasMore = Boolean(dealsNextPage);

  return {
    dataState,
    loadData,
    refreshDeals,
    invalidateDealsCache,
    refreshPolicies,
    updateAppData,
    setAppData,
    loadMoreDeals,
    dealsHasMore,
    isLoading,
    isSyncing,
    setIsSyncing,
    error,
    setError,
    isLoadingMoreDeals,
  };
};
