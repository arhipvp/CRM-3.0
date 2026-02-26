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

export type BackgroundRefreshResource = 'deals' | 'policies' | 'tasks' | 'finance';

export type LastRefreshAtByResource = Record<BackgroundRefreshResource, number | null>;
export type LastRefreshErrorByResource = Record<BackgroundRefreshResource, string | null>;

const DEALS_PAGE_SIZE = 20;
const POLICIES_PAGE_SIZE = 50;

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

const INITIAL_LAST_REFRESH_AT: LastRefreshAtByResource = {
  deals: null,
  policies: null,
  tasks: null,
  finance: null,
};

const INITIAL_LAST_REFRESH_ERRORS: LastRefreshErrorByResource = {
  deals: null,
  policies: null,
  tasks: null,
  finance: null,
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
  const [isFinanceDataLoading, setIsFinanceDataLoading] = useState(false);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [policiesLoaded, setPoliciesLoaded] = useState(false);
  const [isPoliciesLoading, setIsPoliciesLoading] = useState(false);
  const [policiesList, setPoliciesList] = useState<Policy[]>([]);
  const [policiesListNextPage, setPoliciesListNextPage] = useState<number | null>(null);
  const [isPoliciesListLoading, setIsPoliciesListLoading] = useState(false);
  const [isLoadingMorePolicies, setIsLoadingMorePolicies] = useState(false);
  const [policiesFilters, setPoliciesFilters] = useState<FilterParams>({ ordering: '-start_date' });
  const policiesListRequestRef = useRef(0);
  const [dealsFilters, setDealsFilters] = useState<FilterParams>({ ordering: 'next_contact_date' });
  const [dealsNextPage, setDealsNextPage] = useState<number | null>(null);
  const [isLoadingMoreDeals, setIsLoadingMoreDeals] = useState(false);
  const [dealsTotalCount, setDealsTotalCount] = useState(0);
  const [isBackgroundRefreshingDeals, setIsBackgroundRefreshingDeals] = useState(false);
  const [isBackgroundRefreshingPoliciesList, setIsBackgroundRefreshingPoliciesList] =
    useState(false);
  const [isBackgroundRefreshingTasks, setIsBackgroundRefreshingTasks] = useState(false);
  const [isBackgroundRefreshingFinance, setIsBackgroundRefreshingFinance] = useState(false);
  const [lastRefreshAtByResource, setLastRefreshAtByResource] =
    useState<LastRefreshAtByResource>(INITIAL_LAST_REFRESH_AT);
  const [lastRefreshErrorByResource, setLastRefreshErrorByResource] =
    useState<LastRefreshErrorByResource>(INITIAL_LAST_REFRESH_ERRORS);
  const dealsRequestRef = useRef(0);
  const financeDataLoadedRef = useRef(false);
  const tasksLoadedRef = useRef(false);
  const backgroundRefreshInFlightRef = useRef<Record<BackgroundRefreshResource, boolean>>({
    deals: false,
    policies: false,
    tasks: false,
    finance: false,
  });
  const dealsCacheRef = useRef(
    new Map<string, { results: Deal[]; nextPage: number | null; totalCount: number }>(),
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

  const resetPoliciesState = useCallback(() => {
    setPoliciesLoaded(false);
    setIsPoliciesLoading(false);
  }, []);

  const resetPoliciesListState = useCallback(() => {
    setPoliciesList([]);
    setPoliciesListNextPage(null);
    setIsPoliciesListLoading(false);
    setIsLoadingMorePolicies(false);
    setPoliciesFilters({ ordering: '-start_date' });
  }, []);

  const updateAppData = useCallback((updater: (prev: AppDataState) => Partial<AppDataState>) => {
    dispatch({ type: 'update', updater });
  }, []);

  const setBackgroundRefreshingState = useCallback(
    (resource: BackgroundRefreshResource, value: boolean) => {
      if (resource === 'deals') {
        setIsBackgroundRefreshingDeals(value);
        return;
      }
      if (resource === 'policies') {
        setIsBackgroundRefreshingPoliciesList(value);
        return;
      }
      if (resource === 'tasks') {
        setIsBackgroundRefreshingTasks(value);
        return;
      }
      setIsBackgroundRefreshingFinance(value);
    },
    [],
  );

  const refreshDeals = useCallback(
    async (filters?: FilterParams, options?: { force?: boolean }) => {
      dealsRequestRef.current += 1;
      const requestId = dealsRequestRef.current;
      const resolvedFilters = { ordering: 'next_contact_date', ...(filters ?? {}) };
      const cacheKey = buildDealsCacheKey(resolvedFilters);
      const force = options?.force ?? false;
      if (!force) {
        const cached = dealsCacheRef.current.get(cacheKey);
        if (cached) {
          if (dealsRequestRef.current !== requestId) {
            return cached.results;
          }
          setAppData({ deals: cached.results });
          setDealsFilters(resolvedFilters);
          setDealsNextPage(cached.nextPage);
          setDealsTotalCount(cached.totalCount);
          return cached.results;
        }
      }
      const payload = await fetchDealsWithPagination(
        {
          ...resolvedFilters,
          page: 1,
          page_size: DEALS_PAGE_SIZE,
        },
        { embed: 'none' },
      );
      if (dealsRequestRef.current !== requestId) {
        return payload.results;
      }
      const results = payload.results;
      const nextPage = payload.next ? 2 : null;
      dealsCacheRef.current.set(cacheKey, {
        results,
        nextPage,
        totalCount: payload.count,
      });
      setAppData({ deals: results });
      setDealsFilters(resolvedFilters);
      setDealsNextPage(nextPage);
      setDealsTotalCount(payload.count);
      return results;
    },
    [setAppData],
  );

  const loadMoreDeals = useCallback(async () => {
    if (!dealsNextPage || isLoadingMoreDeals) {
      return;
    }
    setIsLoadingMoreDeals(true);
    const requestId = dealsRequestRef.current;
    const cacheKey = buildDealsCacheKey(dealsFilters);
    try {
      const payload = await fetchDealsWithPagination(
        {
          ...dealsFilters,
          page: dealsNextPage,
          page_size: DEALS_PAGE_SIZE,
        },
        { embed: 'none' },
      );
      if (dealsRequestRef.current !== requestId) {
        return;
      }
      updateAppData((prev) => {
        const extended = [...prev.deals, ...payload.results];
        dealsCacheRef.current.set(cacheKey, {
          results: extended,
          nextPage: payload.next ? dealsNextPage + 1 : null,
          totalCount: payload.count,
        });
        return { deals: extended };
      });
      setDealsNextPage(payload.next ? dealsNextPage + 1 : null);
      setDealsTotalCount(payload.count);
    } catch (err) {
      setError(formatErrorMessage(err, 'Error loading more deals'));
    } finally {
      if (dealsRequestRef.current === requestId) {
        setIsLoadingMoreDeals(false);
      }
    }
  }, [dealsFilters, dealsNextPage, isLoadingMoreDeals, setError, updateAppData]);

  const refreshPolicies = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      if (policiesLoaded && !force) {
        return;
      }
      if (isPoliciesLoading) {
        return;
      }
      setIsPoliciesLoading(true);
      try {
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
        setPoliciesLoaded(true);
      } finally {
        setIsPoliciesLoading(false);
      }
    },
    [isPoliciesLoading, policiesLoaded, setAppData],
  );

  const normalizePolicyOrdering = (value?: string) => {
    if (!value) {
      return value;
    }
    const mapping: Record<string, string> = {
      startDate: 'start_date',
      '-startDate': '-start_date',
      endDate: 'end_date',
      '-endDate': '-end_date',
      client__name: 'client',
      '-client__name': '-client',
    };
    return mapping[value] ?? value;
  };

  const refreshPoliciesList = useCallback(
    async (filters?: FilterParams) => {
      setIsPoliciesListLoading(true);
      setError(null);
      policiesListRequestRef.current += 1;
      const requestId = policiesListRequestRef.current;
      const resolvedFilters: FilterParams = {
        ordering: '-start_date',
        ...(filters ?? {}),
      };
      const normalizedOrdering = normalizePolicyOrdering(
        resolvedFilters.ordering as string | undefined,
      );
      if (normalizedOrdering) {
        resolvedFilters.ordering = normalizedOrdering;
      } else {
        delete resolvedFilters.ordering;
      }
      try {
        const payload = await fetchPoliciesWithPagination({
          ...resolvedFilters,
          page: 1,
          page_size: POLICIES_PAGE_SIZE,
        });
        if (policiesListRequestRef.current !== requestId) {
          return;
        }
        setPoliciesList(payload.results);
        setPoliciesListNextPage(payload.next ? 2 : null);
        setPoliciesFilters(resolvedFilters);
      } catch (err) {
        setError(
          formatErrorMessage(
            err,
            '\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0435 \u043f\u043e\u043b\u0438\u0441\u043e\u0432',
          ),
        );
        throw err;
      } finally {
        if (policiesListRequestRef.current === requestId) {
          setIsPoliciesListLoading(false);
        }
      }
    },
    [setError],
  );

  const loadMorePolicies = useCallback(async () => {
    if (!policiesListNextPage || isLoadingMorePolicies) {
      return;
    }
    setIsLoadingMorePolicies(true);
    setError(null);
    const requestId = policiesListRequestRef.current;
    try {
      const payload = await fetchPoliciesWithPagination({
        ...policiesFilters,
        page: policiesListNextPage,
        page_size: POLICIES_PAGE_SIZE,
      });
      if (policiesListRequestRef.current !== requestId) {
        return;
      }
      setPoliciesList((prev) => [...prev, ...payload.results]);
      setPoliciesListNextPage(payload.next ? policiesListNextPage + 1 : null);
    } catch (err) {
      setError(
        formatErrorMessage(
          err,
          '\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0435 \u043f\u043e\u043b\u0438\u0441\u043e\u0432',
        ),
      );
      throw err;
    } finally {
      setIsLoadingMorePolicies(false);
    }
  }, [isLoadingMorePolicies, policiesFilters, policiesListNextPage, setError]);

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
    financeDataLoadedRef.current = false;
    tasksLoadedRef.current = false;
    try {
      const dealsPromise = refreshDeals();
      const [clientsData, usersData, salesChannelsData] = await Promise.all([
        fetchClients(),
        fetchUsers(),
        fetchSalesChannels(),
      ]);
      await dealsPromise;
      setAppData({
        clients: clientsData,
        users: usersData,
        salesChannels: salesChannelsData,
        payments: [],
        financialRecords: [],
        statements: [],
        tasks: [],
      });
    } catch (err) {
      setError(
        formatErrorMessage(
          err,
          '\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0435 \u0434\u0430\u043d\u043d\u044b\u0445 \u0441 backend',
        ),
      );
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshDeals, setAppData]);

  const ensureFinanceDataLoaded = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      if (financeDataLoadedRef.current && !force) {
        return;
      }
      if (isFinanceDataLoading) {
        return;
      }
      setIsFinanceDataLoading(true);
      try {
        const [paymentsData, financialRecordsData, statementsData] = await Promise.all([
          fetchAllPayments(),
          fetchFinancialRecords(),
          fetchFinanceStatements(),
        ]);
        setAppData({
          payments: paymentsData,
          financialRecords: financialRecordsData,
          statements: statementsData,
        });
        financeDataLoadedRef.current = true;
      } catch (err) {
        setError(
          formatErrorMessage(
            err,
            '\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0435 \u0444\u0438\u043d\u0430\u043d\u0441\u043e\u0432\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445',
          ),
        );
        throw err;
      } finally {
        setIsFinanceDataLoading(false);
      }
    },
    [fetchAllPayments, isFinanceDataLoading, setAppData, setError],
  );

  const ensureTasksLoaded = useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      if (tasksLoadedRef.current && !force) {
        return;
      }
      if (isTasksLoading) {
        return;
      }
      setIsTasksLoading(true);
      try {
        const tasksData = await fetchTasks({ show_deleted: true });
        setAppData({ tasks: tasksData });
        tasksLoadedRef.current = true;
      } catch (err) {
        setError(
          formatErrorMessage(
            err,
            '\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u0440\u0438 \u0437\u0430\u0433\u0440\u0443\u0437\u043a\u0435 \u0437\u0430\u0434\u0430\u0447',
          ),
        );
        throw err;
      } finally {
        setIsTasksLoading(false);
      }
    },
    [isTasksLoading, setAppData, setError],
  );

  const dealsHasMore = Boolean(dealsNextPage);
  const policiesHasMore = Boolean(policiesListNextPage);
  const isBackgroundRefreshingAny =
    isBackgroundRefreshingDeals ||
    isBackgroundRefreshingPoliciesList ||
    isBackgroundRefreshingTasks ||
    isBackgroundRefreshingFinance;

  const runBackgroundRefresh = useCallback(
    async (
      resource: BackgroundRefreshResource,
      runner: () => Promise<unknown>,
    ): Promise<{ executed: boolean; errorMessage: string | null }> => {
      if (backgroundRefreshInFlightRef.current[resource]) {
        return { executed: false, errorMessage: null };
      }

      backgroundRefreshInFlightRef.current[resource] = true;
      setBackgroundRefreshingState(resource, true);
      setLastRefreshErrorByResource((prev) => ({ ...prev, [resource]: null }));

      try {
        await runner();
        setLastRefreshAtByResource((prev) => ({ ...prev, [resource]: Date.now() }));
        setLastRefreshErrorByResource((prev) => ({ ...prev, [resource]: null }));
        return { executed: true, errorMessage: null };
      } catch (err) {
        const errorMessage = formatErrorMessage(err);
        setLastRefreshErrorByResource((prev) => ({ ...prev, [resource]: errorMessage }));
        return { executed: true, errorMessage };
      } finally {
        backgroundRefreshInFlightRef.current[resource] = false;
        setBackgroundRefreshingState(resource, false);
      }
    },
    [setBackgroundRefreshingState],
  );

  return {
    dataState,
    loadData,
    ensureFinanceDataLoaded,
    ensureTasksLoaded,
    refreshDeals,
    invalidateDealsCache,
    refreshPolicies,
    refreshPoliciesList,
    policiesFilters,
    runBackgroundRefresh,
    updateAppData,
    setAppData,
    resetPoliciesState,
    resetPoliciesListState,
    loadMoreDeals,
    dealsHasMore,
    dealsTotalCount,
    policiesList,
    loadMorePolicies,
    policiesHasMore,
    isPoliciesListLoading,
    isLoadingMorePolicies,
    isPoliciesLoading,
    isLoading,
    isFinanceDataLoading,
    isTasksLoading,
    isSyncing,
    setIsSyncing,
    isBackgroundRefreshingDeals,
    isBackgroundRefreshingPoliciesList,
    isBackgroundRefreshingTasks,
    isBackgroundRefreshingFinance,
    isBackgroundRefreshingAny,
    lastRefreshAtByResource,
    lastRefreshErrorByResource,
    error,
    setError,
    isLoadingMoreDeals,
  };
};
