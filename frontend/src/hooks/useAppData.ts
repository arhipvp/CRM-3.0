import { useCallback, useReducer, useState } from 'react';

import {
  fetchClients,
  fetchDealsWithPagination,
  fetchFinancialRecords,
  fetchKnowledgeDocuments,
  fetchPayments,
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
  KnowledgeDocument,
  Payment,
  Policy,
  SalesChannel,
  Task,
  User,
} from '../types';

interface AppDataState {
  clients: Client[];
  deals: Deal[];
  policies: Policy[];
  salesChannels: SalesChannel[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  tasks: Task[];
  users: User[];
  knowledgeDocs: KnowledgeDocument[];
  knowledgeLoading: boolean;
  knowledgeError: string | null;
  knowledgeUploading: boolean;
}

const DEALS_PAGE_SIZE = 20;

const INITIAL_APP_DATA_STATE: AppDataState = {
  clients: [],
  deals: [],
  policies: [],
  salesChannels: [],
  payments: [],
  financialRecords: [],
  tasks: [],
  users: [],
  knowledgeDocs: [],
  knowledgeLoading: false,
  knowledgeError: null,
  knowledgeUploading: false,
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

export const useAppData = () => {
  const [dataState, dispatch] = useReducer(dataReducer, INITIAL_APP_DATA_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dealsFilters, setDealsFilters] = useState<FilterParams>({ ordering: 'next_contact_date' });
  const [dealsNextPage, setDealsNextPage] = useState<number | null>(null);
  const [isLoadingMoreDeals, setIsLoadingMoreDeals] = useState(false);

  const setAppData = useCallback((payload: Partial<AppDataState>) => {
    dispatch({ type: 'assign', payload });
  }, []);

  const updateAppData = useCallback((updater: (prev: AppDataState) => Partial<AppDataState>) => {
    dispatch({ type: 'update', updater });
  }, []);

  const refreshDeals = useCallback(async (filters?: FilterParams) => {
    const resolvedFilters = { ordering: 'next_contact_date', ...(filters ?? {}) };
    const payload = await fetchDealsWithPagination({
      ...resolvedFilters,
      page: 1,
      page_size: DEALS_PAGE_SIZE,
    });
    setAppData({ deals: payload.results });
    setDealsFilters(resolvedFilters);
    setDealsNextPage(payload.next ? 2 : null);
    return payload.results;
  }, [setAppData]);

  const loadMoreDeals = useCallback(async () => {
    if (!dealsNextPage || isLoadingMoreDeals) {
      return;
    }
    setIsLoadingMoreDeals(true);
    try {
      const payload = await fetchDealsWithPagination({
        ...dealsFilters,
        page: dealsNextPage,
        page_size: DEALS_PAGE_SIZE,
      });
      updateAppData((prev) => ({
        deals: [...prev.deals, ...payload.results],
      }));
      setDealsNextPage(payload.next ? dealsNextPage + 1 : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сделки');
    } finally {
      setIsLoadingMoreDeals(false);
    }
  }, [dealsFilters, dealsNextPage, isLoadingMoreDeals, setError, updateAppData]);

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

  const refreshKnowledgeDocuments = useCallback(async () => {
    setAppData({ knowledgeLoading: true, knowledgeError: null });
    try {
      const docs = await fetchKnowledgeDocuments();
      setAppData({ knowledgeDocs: docs });
    } catch (err) {
      setAppData({
        knowledgeError:
          err instanceof Error ? err.message : 'Ошибка при загрузке справочной базы',
      });
      throw err;
    } finally {
      setAppData({ knowledgeLoading: false });
    }
  }, [setAppData]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dealsPromise = refreshDeals();
      const [clientsData, paymentsData, tasksData, financialRecordsData, usersData, salesChannelsData] =
        await Promise.all([
          fetchClients(),
          fetchPayments(),
          fetchTasks(),
          fetchFinancialRecords(),
          fetchUsers(),
          fetchSalesChannels(),
        ]);
      await dealsPromise;
      await refreshPolicies();
      setAppData({
        clients: clientsData,
        payments: paymentsData,
        tasks: tasksData,
        financialRecords: financialRecordsData,
        users: usersData,
        salesChannels: salesChannelsData,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при загрузке данных с backend');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [refreshDeals, refreshPolicies, setAppData]);

  const dealsHasMore = Boolean(dealsNextPage);

  return {
    dataState,
    loadData,
    refreshDeals,
    refreshKnowledgeDocuments,
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
