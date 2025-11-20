import { useCallback, useReducer, useState } from 'react';

import {
  fetchClients,
  fetchDeals,
  fetchFinancialRecords,
  fetchKnowledgeDocuments,
  fetchPayments,
  fetchPolicies,
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

  const setAppData = useCallback((payload: Partial<AppDataState>) => {
    dispatch({ type: 'assign', payload });
  }, []);

  const updateAppData = useCallback((updater: (prev: AppDataState) => Partial<AppDataState>) => {
    dispatch({ type: 'update', updater });
  }, []);

  const refreshDeals = useCallback(async (filters?: FilterParams) => {
    const resolvedFilters = { ordering: 'next_contact_date', ...(filters ?? {}) };
    const payload = await fetchDeals(resolvedFilters);
    setAppData({ deals: payload });
    return payload;
  }, [setAppData]);

  const refreshPolicies = useCallback(async () => {
    const payload = await fetchPolicies();
    setAppData({ policies: payload });
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

  return {
    dataState,
    loadData,
    refreshDeals,
    refreshKnowledgeDocuments,
    updateAppData,
    setAppData,
    isLoading,
    isSyncing,
    setIsSyncing,
    error,
    setError,
  };
};
