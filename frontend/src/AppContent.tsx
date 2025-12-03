import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { LoginPage } from './components/LoginPage';
import { useNotification } from './contexts/NotificationContext';
import { NotificationDisplay } from './components/NotificationDisplay';
import { AppModals } from './components/app/AppModals';
import { AppRoutes } from './components/app/AppRoutes';
import { ClientForm } from './components/forms/ClientForm';
import type { AddFinancialRecordFormValues } from './components/forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from './components/forms/AddPaymentForm';
import type { AddTaskFormValues } from './components/forms/AddTaskForm';
import type { EditDealFormValues } from './components/forms/EditDealForm';
import type { FinancialRecordDraft, PolicyFormValues } from './components/forms/addPolicy/types';
import type { QuoteFormValues } from './components/forms/AddQuoteForm';
import type { ModalType, FinancialRecordModalState, PaymentModalState } from './components/app/types';
import { Modal } from './components/Modal';
import {
  createClient,
  deleteClient,
  mergeClients,
  createDeal,
  createQuote,
  updateQuote,
  createPolicy,
  updatePolicy,
  createPayment,
  createFinancialRecord,
  updateFinancialRecord,
  deleteFinancialRecord,
  deleteQuote,
  deletePolicy,
  deleteDeal,
  restoreDeal,
  fetchChatMessages,
  createChatMessage,
  deleteChatMessage,
  closeDeal,
  reopenDeal,
  updateDeal,
  updateClient,
  mergeDeals,
  updatePayment,
  fetchDealHistory,
  fetchDeal,
  createTask,
  updateTask,
  deleteTask,
  getCurrentUser,
  hasStoredTokens,
  clearTokens,
  APIError,
  uploadKnowledgeDocument,
} from './api';
import type { CurrentUserResponse, FilterParams } from './api';
import { Client, Deal, FinancialRecord, Payment, Policy, Quote, User } from './types';
import { useAppData } from './hooks/useAppData';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useDealFilters } from './hooks/useDealFilters';
import { getUserDisplayName } from './components/views/dealsView/helpers';
const normalizeStringValue = (value: unknown): string =>
  typeof value === 'string' ? value : value ? String(value) : '';

const normalizeDateValue = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return '';
};

const buildPolicyDraftFromRecognition = (
  parsed: Record<string, unknown>
): PolicyFormValues => {
  const policy = (parsed.policy ?? {}) as Record<string, unknown>;
  const paymentsRaw = Array.isArray(parsed.payments)
    ? (parsed.payments as Record<string, unknown>[])
    : [];
  const payments =
    paymentsRaw.length > 0
      ? paymentsRaw.map((payment) => ({
          amount: normalizeStringValue(payment.amount),
          description: '',
          scheduledDate: normalizeDateValue(payment.payment_date),
          actualDate: '',
          incomes: [
            {
              amount: normalizeStringValue(payment.amount),
              date: normalizeDateValue(payment.payment_date),
              description: '',
              source: '',
              note: '',
            },
          ],
          expenses: [],
        }))
      : [
        {
          amount: '',
          description: '',
          scheduledDate: '',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
      ];

  return {
    number: normalizeStringValue(policy.policy_number),
    insuranceCompanyId: '',
    insuranceTypeId: '',
    isVehicle: Boolean(policy.vehicle_brand || policy.vehicle_model || policy.vehicle_vin),
    brand: normalizeStringValue(policy.vehicle_brand),
    model: normalizeStringValue(policy.vehicle_model),
    vin: normalizeStringValue(policy.vehicle_vin),
    counterparty: normalizeStringValue(policy.contractor),
    startDate: normalizeDateValue(policy.start_date) || null,
    endDate: normalizeDateValue(policy.end_date) || null,
    payments,
  };
};

const resolveRoleNames = (userData: CurrentUserResponse): string[] => {
  const parsed = userData.user_roles
    ?.map((ur) => ur.role?.name)
    .filter((name): name is string => Boolean(name)) ?? [];
  if (parsed.length > 0) {
    return parsed;
  }
  return userData.roles ?? [];
};

const mapApiUser = (userData: CurrentUserResponse): User => ({
  id: String(userData.id),
  username: userData.username,
  roles: resolveRoleNames(userData),
  firstName: userData.first_name ?? undefined,
  lastName: userData.last_name ?? undefined,
});

const AppContent: React.FC = () => {
  const { addNotification } = useNotification();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [pendingModalAfterClient, setPendingModalAfterClient] = useState<ModalType>(null);
  const openClientModal = (afterModal: ModalType | null = null) => {
    setPendingModalAfterClient(afterModal);
    setModal('client');
  };

  const closeClientModal = () => {
    const nextModal = pendingModalAfterClient;
    setPendingModalAfterClient(null);
    setModal(nextModal ?? null);
  };
  const [quoteDealId, setQuoteDealId] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [policyDealId, setPolicyDealId] = useState<string | null>(null);
  const [policyPrefill, setPolicyPrefill] = useState<{
    values: PolicyFormValues;
    insuranceCompanyName?: string;
    insuranceTypeName?: string;
  } | null>(null);
  const [policyDefaultCounterparty, setPolicyDefaultCounterparty] = useState<string | undefined>(undefined);
  const [policySourceFileId, setPolicySourceFileId] = useState<string | null>(null);

  const closePolicyModal = useCallback(() => {
    setPolicyDealId(null);
    setPolicyPrefill(null);
    setPolicyDefaultCounterparty(undefined);
    setPolicySourceFileId(null);
  }, []);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState | null>(null);
  const [financialRecordModal, setFinancialRecordModal] =
    useState<FinancialRecordModalState | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientDeleteTarget, setClientDeleteTarget] = useState<Client | null>(null);
  const [mergeClientTargetId, setMergeClientTargetId] = useState<string | null>(null);
  const [mergeSources, setMergeSources] = useState<string[]>([]);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isMergingClients, setIsMergingClients] = useState(false);
  const {
    dataState,
    loadData,
    refreshDeals,
    refreshKnowledgeDocuments,
    updateAppData,
    setAppData,
    loadMoreDeals,
    dealsHasMore,
    isLoadingMoreDeals,
    isLoading,
    isSyncing,
    setIsSyncing,
    error,
    setError,
  } = useAppData();
  const {
    clients,
    deals,
    policies,
    salesChannels,
    payments,
    financialRecords,
    tasks,
    users,
    knowledgeDocs,
    knowledgeLoading,
    knowledgeError,
    knowledgeUploading,
  } = dataState;
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const {
    dealSearch,
    setDealSearch,
    dealExecutorFilter,
    setDealExecutorFilter,
    dealSourceFilter,
    setDealSourceFilter,
  dealExpectedCloseFrom,
  setDealExpectedCloseFrom,
  dealExpectedCloseTo,
  setDealExpectedCloseTo,
  dealShowDeleted,
  setDealShowDeleted,
  filters: dealFilters,
  } = useDealFilters();
  const dealsById = useMemo(() => {
    const map = new Map<string, Deal>();
    deals.forEach((deal) => {
      map.set(deal.id, deal);
    });
    return map;
  }, [deals]);
  const searchInitialized = useRef(false);
  const location = useLocation();

  const refreshDealsWithSelection = useCallback(
    async (filters?: FilterParams, options?: { force?: boolean }) => {
      const dealsData = await refreshDeals(filters, options);
      setSelectedDealId((prev) => {
        if (prev && dealsData.some((deal) => deal.id === prev)) {
          return prev;
        }
        return dealsData[0]?.id ?? null;
      });
      return dealsData;
    },
    [refreshDeals]
  );

  const handlePolicyDraftReady = useCallback(
    (
      dealId: string,
      parsed: Record<string, unknown>,
      _fileName?: string | null,
      fileId?: string | null
    ) => {
      if (!parsed) {
        return;
      }
      const draft = buildPolicyDraftFromRecognition(parsed);
      const policyObj = (parsed.policy ?? {}) as Record<string, unknown>;
      const recognizedSalesChannel = normalizeStringValue(policyObj.sales_channel);
      const matchedChannel = salesChannels.find(
        (channel) => channel.name.toLowerCase() === recognizedSalesChannel.toLowerCase()
      );
      const values = {
        ...draft,
        salesChannelId: matchedChannel?.id,
      };
      setPolicyDealId(dealId);
      setPolicyDefaultCounterparty(undefined);
      setPolicySourceFileId(fileId ?? null);
      setPolicyPrefill({
        values,
        insuranceCompanyName: normalizeStringValue(policyObj.insurance_company),
        insuranceTypeName: normalizeStringValue(policyObj.insurance_type),
      });
    },
    [salesChannels]
  );

  const handleRequestAddPolicy = (dealId: string) => {
    const deal = dealsById.get(dealId);
    const executorUser = deal?.executor ? users.find((user) => user.id === deal.executor) : null;
    const counterpartyName =
      executorUser ? getUserDisplayName(executorUser) : deal?.executorName ?? '';
    setPolicyDefaultCounterparty(counterpartyName || undefined);
    setPolicyPrefill(null);
    setPolicySourceFileId(null);
    setPolicyDealId(dealId);
  };

  const debouncedDealFilters = useDebouncedValue(dealFilters, 300);

  useEffect(() => {
    if (!isAuthenticated) {
      searchInitialized.current = false;
      return;
    }

    if (!searchInitialized.current) {
      searchInitialized.current = true;
      return;
    }

    setError(null);
    refreshDealsWithSelection(debouncedDealFilters).catch((err) => {
      console.error('Search deals error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при поиске сделок');
    });
  }, [
    debouncedDealFilters,
    refreshDealsWithSelection,
    isAuthenticated,
    setError,
  ]);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (location.pathname === '/knowledge') {
      refreshKnowledgeDocuments();
    }
  }, [isAuthenticated, refreshKnowledgeDocuments, location.pathname]);

  // Check authentication on app load
  useEffect(() => {
    if (!hasStoredTokens()) {
      setAuthLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        console.log('Checking authentication...');
        const userData = await getCurrentUser();
        console.log('User data:', userData);
        if (!userData?.is_authenticated) {
          clearTokens();
          setCurrentUser(null);
          setIsAuthenticated(false);
          return;
        }
        // Parse roles from the API response structure
        const user = mapApiUser(userData);
        console.log('Setting current user:', user);
        setCurrentUser(user);
        setIsAuthenticated(true);
        await loadData();
      } catch (err) {
        console.error('Auth error:', err);
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [loadData]);

  const handleAddClient = async (data: {
    name: string;
    phone?: string;
    birthDate?: string | null;
    notes?: string | null;
    email?: string | null;
  }) => {
    const created = await createClient(data);
    updateAppData((prev) => ({ clients: [created, ...prev.clients] }));
    const nextModal = pendingModalAfterClient;
    setPendingModalAfterClient(null);
    setModal(nextModal ?? null);
  };

  const handleClientEditRequest = useCallback((client: Client) => {
    setEditingClient(client);
  }, []);

  const handleUpdateClient = useCallback(
    async (data: {
      name: string;
      phone?: string;
      email?: string | null;
      birthDate?: string | null;
      notes?: string | null;
    }) => {
      if (!editingClient) {
        return;
      }
      try {
        const updated = await updateClient(editingClient.id, data);
        updateAppData((prev) => ({
          clients: prev.clients.map((client) =>
            client.id === updated.id ? updated : client
          ),
        }));
        addNotification('Клиент обновлён', 'success', 4000);
        setEditingClient(null);
        setError(null);
      } catch (err) {
        const message =
          err instanceof APIError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Ошибка при обновлении клиента';
        setError(message);
        throw err;
      }
    },
    [addNotification, editingClient, setError, updateAppData]
  );

  const handleClientDeleteRequest = useCallback((client: Client) => {
    setClientDeleteTarget(client);
  }, []);

  const handleDeleteClient = useCallback(async () => {
    if (!clientDeleteTarget) {
      return;
    }
    setIsSyncing(true);
    try {
      await deleteClient(clientDeleteTarget.id);
      updateAppData((prev) => ({
        clients: prev.clients.filter((client) => client.id !== clientDeleteTarget.id),
      }));
      addNotification('Клиент удалён', 'success', 4000);
      setClientDeleteTarget(null);
      setError(null);
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Ошибка доступа при удалении клиента', 'error', 4000);
      } else {
        setError(
          err instanceof APIError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Ошибка при удалении клиента'
        );
      }
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, [addNotification, clientDeleteTarget, setError, setIsSyncing, updateAppData]);

  const handleClientMergeRequest = useCallback((client: Client) => {
    setMergeClientTargetId(client.id);
    setMergeSources([]);
    setMergeSearch('');
    setMergeError(null);
  }, []);

  const toggleMergeSource = useCallback((clientId: string) => {
    setMergeSources((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId]
    );
    setMergeError(null);
  }, []);

  const closeMergeModal = useCallback(() => {
    setMergeClientTargetId(null);
    setMergeSources([]);
    setMergeSearch('');
    setMergeError(null);
  }, []);

  const handleMergeSubmit = useCallback(async () => {
    if (!mergeClientTargetId) {
      return;
    }
    if (!mergeSources.length) {
      setMergeError('Выберите клиентов для объединения.');
      return;
    }
    setIsSyncing(true);
    setIsMergingClients(true);
    try {
      const result = await mergeClients({
        targetClientId: mergeClientTargetId,
        sourceClientIds: mergeSources,
      });
      const mergedIds = new Set(result.mergedClientIds);
      updateAppData((prev) => ({
        clients: prev.clients
          .filter((client) => !mergedIds.has(client.id))
          .map((client) =>
            client.id === result.targetClient.id ? result.targetClient : client
          ),
        deals: prev.deals.map((deal) =>
          mergedIds.has(deal.clientId)
            ? {
              ...deal,
              clientId: result.targetClient.id,
              clientName: result.targetClient.name,
            }
            : deal
        ),
        policies: prev.policies.map((policy) => {
          const policyClientId = policy.clientId ?? '';
          if (!policyClientId || !mergedIds.has(policyClientId)) {
            return policy;
          }
          return {
            ...policy,
            clientId: result.targetClient.id,
            clientName: result.targetClient.name,
          };
        }),
      }));
      addNotification('Клиенты объединены', 'success', 4000);
      closeMergeModal();
      setError(null);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка при объединении клиентов';
      setMergeError(message);
      throw err;
    } finally {
      setIsSyncing(false);
      setIsMergingClients(false);
    }
  }, [
    addNotification,
    closeMergeModal,
    mergeClientTargetId,
    mergeSources,
    setIsMergingClients,
    setIsSyncing,
    setError,
    updateAppData,
  ]);

  const mergeCandidates = useMemo(() => {
    if (!mergeClientTargetId) {
      return [];
    }
    const normalized = mergeSearch.trim().toLowerCase();
    return clients.filter((client) => {
      if (client.id === mergeClientTargetId) {
        return false;
      }
      if (!normalized) {
        return true;
      }
      return client.name.toLowerCase().includes(normalized);
    });
  }, [clients, mergeClientTargetId, mergeSearch]);

  const mergeTargetClient = mergeClientTargetId
    ? clients.find((client) => client.id === mergeClientTargetId) ?? null
    : null;

  const handleAddDeal = async (data: {
    title: string;
    clientId: string;
    description?: string;
    expectedClose?: string | null;
    executorId?: string | null;
    source?: string;
  }) => {
    const created = await createDeal({
      title: data.title,
      clientId: data.clientId,
      description: data.description,
      expectedClose: data.expectedClose,
      executorId: data.executorId,
      source: data.source,
    });
    updateAppData((prev) => ({ deals: [created, ...prev.deals] }));
    setSelectedDealId(created.id);
    setModal(null);
  };

  const handleKnowledgeUpload = useCallback(
    async (file: File, metadata: { title?: string; description?: string }) => {
      setAppData({ knowledgeUploading: true });
      try {
        await uploadKnowledgeDocument(file, metadata);
        await refreshKnowledgeDocuments();
      } catch (err) {
        const message = err instanceof Error ? err : new Error('Ошибка при загрузке справочной базы');
        throw message;
      } finally {
        setAppData({ knowledgeUploading: false });
      }
    },
    [refreshKnowledgeDocuments, setAppData]
  );

  const handleCloseDeal = async (
    dealId: string,
    payload: { reason: string; status?: 'won' | 'lost' }
  ) => {
    setIsSyncing(true);
    try {
      const updated = await closeDeal(dealId, payload);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) => (deal.id === updated.id ? updated : deal)),
      }));
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка при закрытии сделки';
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleReopenDeal = async (dealId: string) => {
    setIsSyncing(true);
    try {
      const updated = await reopenDeal(dealId);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) => (deal.id === updated.id ? updated : deal)),
      }));
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Ошибка доступа при восстановлении сделки', 'error', 4000);
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка при восстановлении сделки');
      }
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateDeal = async (dealId: string, data: EditDealFormValues) => {
    setIsSyncing(true);
    try {
      const updated = await updateDeal(dealId, data);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) => (deal.id === updated.id ? updated : deal)),
      }));
      setSelectedDealId(updated.id);
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Ошибка доступа при обновлении сделки', 'error', 4000);
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка при обновлении сделки');
      }
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };
  const handleDeleteDeal = useCallback(
    async (dealId: string) => {
      if (!confirm('Вы уверены, что хотите удалить эту сделку?')) {
        return;
      }

      setIsSyncing(true);
      try {
        await deleteDeal(dealId);
        await refreshDealsWithSelection(dealFilters, { force: true });
        setError(null);
        addNotification('Сделка удалена', 'success', 4000);
      } catch (err) {
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при удалении сделки', 'error', 4000);
        } else {
          setError(err instanceof Error ? err.message : 'Не удалось удалить сделку');
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, dealFilters, refreshDealsWithSelection, setError, setIsSyncing]
  );

  const handleRestoreDeal = useCallback(
    async (dealId: string) => {
      setIsSyncing(true);
      try {
        const restored = await restoreDeal(dealId);
        await refreshDealsWithSelection(dealFilters, { force: true });
        setSelectedDealId(restored.id);
        setError(null);
        addNotification('Сделка восстановлена', 'success', 4000);
      } catch (err) {
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при восстановлении сделки', 'error', 4000);
        } else {
          setError(err instanceof Error ? err.message : 'Не удалось восстановить сделку');
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, dealFilters, refreshDealsWithSelection, setError, setSelectedDealId, setIsSyncing]
  );

  const handleMergeDeals = useCallback(
    async (targetDealId: string, sourceDealIds: string[], resultingClientId?: string) => {
      setIsSyncing(true);
      try {
        const result = await mergeDeals({ targetDealId, sourceDealIds, resultingClientId });
        updateAppData((prev) => ({
          deals: prev.deals
            .filter((deal) => !result.mergedDealIds.includes(deal.id))
            .map((deal) => (deal.id === result.targetDeal.id ? result.targetDeal : deal)),
        }));
        setSelectedDealId(result.targetDeal.id);
        setError(null);
        addNotification('Сделки объединены', 'success', 4000);
      } catch (err) {
        const message =
          err instanceof APIError
            ? err.message
            : err instanceof Error
              ? err.message
              : 'Ошибка объединения сделок';
        setError(message);
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, setError, setSelectedDealId, setIsSyncing, updateAppData]
  );

  const handleAddQuote = async (dealId: string, values: QuoteFormValues) => {
    try {
      const created = await createQuote({ dealId, ...values });
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) =>
          deal.id === dealId ? { ...deal, quotes: [created, ...(deal.quotes ?? [])] } : deal
        ),
      }));
      setQuoteDealId(null);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка при добавлении предложения';
      setError(message);
      throw err;
    }
  };

  const handleUpdateQuote = async (values: QuoteFormValues) => {
    if (!editingQuote) {
      return;
    }
    const { id, dealId } = editingQuote;
    try {
      const updated = await updateQuote(id, values);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) =>
          deal.id === dealId
            ? {
              ...deal,
              quotes: deal.quotes
                ? deal.quotes.map((quote) => (quote.id === id ? updated : quote))
                : [updated],
            }
            : deal
        ),
      }));
      setEditingQuote(null);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка при обновлении предложения';
      setError(message);
      throw err;
    }
  };

  const handleRequestEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
  };

  const handleDeleteQuote = async (dealId: string, quoteId: string) => {
    try {
      await deleteQuote(quoteId);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) =>
          deal.id === dealId
            ? { ...deal, quotes: deal.quotes?.filter((quote) => quote.id !== quoteId) ?? [] }
            : deal
        ),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении предложения');
      throw err;
    }
  };

  const handleAddPolicy = async (dealId: string, values: PolicyFormValues) => {
    const {
      number,
      insuranceCompanyId,
      insuranceTypeId,
      isVehicle,
      brand,
      model,
      vin,
      startDate,
      endDate,
      salesChannelId,
      payments: paymentDrafts = [],
    } = values;
    const sourceFileId = policySourceFileId;
    let deal = dealsById.get(dealId);
    let clientId = deal?.clientId;
    if (!clientId) {
      try {
        const fetchedDeal = await fetchDeal(dealId);
        deal = fetchedDeal;
        clientId = fetchedDeal.clientId;
        updateAppData((prev) => ({
          deals: prev.deals.some((item) => item.id === dealId)
            ? prev.deals
            : [fetchedDeal, ...prev.deals],
        }));
      } catch (err) {
        const message =
          err instanceof APIError ? err.message : err instanceof Error ? err.message : 'Ошибка при получении сделки';
        setError(message);
        throw err;
      }
    }

    try {
      const created = await createPolicy({
        dealId,
        clientId,
        number,
        insuranceCompanyId,
        insuranceTypeId,
        isVehicle,
        salesChannelId,
        brand,
        model,
        vin,
        startDate,
        endDate,
        sourceFileId,
      });
      updateAppData((prev) => ({ policies: [created, ...prev.policies] }));

      for (const paymentDraft of paymentDrafts) {
        const amount = Number(paymentDraft.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          continue;
        }

        const payment = await createPayment({
          dealId,
          policyId: created.id,
          amount,
          description: paymentDraft.description,
          scheduledDate: paymentDraft.scheduledDate || null,
          actualDate: paymentDraft.actualDate || null,
        });
        const createdRecords: FinancialRecord[] = [];

        for (const income of paymentDraft.incomes) {
          const incomeAmount = Number(income.amount);
          if (!Number.isFinite(incomeAmount) || incomeAmount <= 0) {
            continue;
          }

          const record = await createFinancialRecord({
            paymentId: payment.id,
            amount: incomeAmount,
            date: income.date || null,
            description: income.description,
            source: income.source,
            note: income.note,
          });
          createdRecords.push(record);
        }

        for (const expense of paymentDraft.expenses) {
          const expenseAmount = Number(expense.amount);
          if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
            continue;
          }

          const record = await createFinancialRecord({
            paymentId: payment.id,
            amount: -Math.abs(expenseAmount),
            date: expense.date || null,
            description: expense.description,
            source: expense.source,
            note: expense.note,
          });
          createdRecords.push(record);
        }

        const paymentWithRecords: Payment = {
          ...payment,
          financialRecords: createdRecords.length
            ? [...createdRecords, ...(payment.financialRecords ?? [])]
            : payment.financialRecords,
        };
        updateAppData((prev) => ({
          payments: [paymentWithRecords, ...prev.payments],
          financialRecords:
            createdRecords.length > 0
              ? [...createdRecords, ...prev.financialRecords]
              : prev.financialRecords,
        }));
      }

      closePolicyModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить полис');
      throw err;
    }
  };
  const handleRequestEditPolicy = (policy: Policy) => {
    setModal(null);
    closePolicyModal();
    setEditingPolicy(policy);
  };
  const handleUpdatePolicy = async (policyId: string, values: PolicyFormValues) => {
    setIsSyncing(true);
    try {
      const {
        number,
        insuranceCompanyId,
        insuranceTypeId,
        isVehicle,
        brand,
        model,
        vin,
        counterparty,
        salesChannelId,
        startDate,
        endDate,
      } = values;
      const updated = await updatePolicy(policyId, {
        number,
        insuranceCompanyId,
        insuranceTypeId,
        isVehicle,
        brand,
        model,
        vin,
        counterparty,
        salesChannelId,
        startDate,
        endDate,
      });
      updateAppData((prev) => ({
        policies: prev.policies.map((policy) => (policy.id === updated.id ? updated : policy)),
      }));
      setEditingPolicy(null);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось обновить полис.';
      setError(message);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };
  const handleDeletePolicy = async (policyId: string) => {
    try {
      await deletePolicy(policyId);
      updateAppData((prev) => ({ policies: prev.policies.filter((policy) => policy.id !== policyId) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить полис');
      throw err;
    }
  };

  const handleDriveFolderCreated = (dealId: string, folderId: string) => {
    updateAppData((prev) => ({
      deals: prev.deals.map((deal) =>
        deal.id === dealId ? { ...deal, driveFolderId: folderId } : deal
      ),
    }));
  };
  const handleFetchChatMessages = async (dealId: string) => {
    try {
      return await fetchChatMessages(dealId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сообщения');
      throw err;
    }
  };

  const handleSendChatMessage = async (dealId: string, body: string) => {
    try {
      await createChatMessage(dealId, body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
      throw err;
    }
  };

  const handleDeleteChatMessage = async (messageId: string) => {
    try {
      await deleteChatMessage(messageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить сообщение');
      throw err;
    }
  };

  const handleCreateTask = async (dealId: string, data: AddTaskFormValues) => {
    setIsSyncing(true);
    try {
      const created = await createTask({ dealId, ...data });
      updateAppData((prev) => ({ tasks: [created, ...prev.tasks] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании задачи');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateTask = async (taskId: string, data: Partial<AddTaskFormValues>) => {
    setIsSyncing(true);
    try {
      const updated = await updateTask(taskId, data);
      updateAppData((prev) => ({
        tasks: prev.tasks.map((task) => (task.id === updated.id ? updated : task)),
      }));
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Ошибка доступа при обновлении задачи', 'error', 4000);
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка при обновлении задачи');
      }
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      updateAppData((prev) => ({ tasks: prev.tasks.filter((task) => task.id !== taskId) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении задачи');
      throw err;
    }
  };

  const handleAddPayment = async (values: AddPaymentFormValues) => {
    try {
      const created = await createPayment({
        policyId: values.policyId,
        dealId: values.dealId ?? undefined,
        amount: parseFloat(values.amount),
        description: values.description,
        scheduledDate: values.scheduledDate || null,
        actualDate: values.actualDate || null,
      });

      const zeroIncome = await createFinancialRecord({
        paymentId: created.id,
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        description: 'Счёт: автоматически создан для учета',
        source: 'Система',
      });

      updateAppData((prev) => ({
        payments: [created, ...prev.payments],
        financialRecords: [zeroIncome, ...prev.financialRecords],
      }));
      setPaymentModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании платежа');
      throw err;
    }
  };

  const handleUpdatePayment = async (paymentId: string, values: AddPaymentFormValues) => {
    try {
      const updated = await updatePayment(paymentId, {
        policyId: values.policyId,
        dealId: values.dealId ?? undefined,
        amount: parseFloat(values.amount),
        description: values.description,
        scheduledDate: values.scheduledDate || null,
        actualDate: values.actualDate || null,
      });
      updateAppData((prev) => ({
        payments: prev.payments.map((payment) => (payment.id === updated.id ? updated : payment)),
      }));
      setPaymentModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении платежа');
      throw err;
    }
  };

  const handleAddFinancialRecord = async (values: AddFinancialRecordFormValues) => {
    const paymentId = values.paymentId || financialRecordModal?.paymentId;
    if (!paymentId) {
      return;
    }
    try {
      const created = await createFinancialRecord({
        paymentId: paymentId,
        amount: parseFloat(values.amount),
        date: values.date || null,
        description: values.description,
        source: values.source,
        note: values.note,
      });
      updateAppData((prev) => ({ financialRecords: [created, ...prev.financialRecords] }));
      setFinancialRecordModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании записи');
      throw err;
    }
  };

  const handleUpdateFinancialRecord = async (recordId: string, values: AddFinancialRecordFormValues) => {
    try {
      const updated = await updateFinancialRecord(recordId, {
        amount: parseFloat(values.amount),
        date: values.date || null,
        description: values.description,
        source: values.source,
        note: values.note,
      });
      updateAppData((prev) => ({
        financialRecords: prev.financialRecords.map((record) =>
          record.id === updated.id ? updated : record
        ),
      }));
      setFinancialRecordModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении записи');
      throw err;
    }
  };

  const handleDeleteFinancialRecord = async (recordId: string) => {
    try {
      await deleteFinancialRecord(recordId);
      updateAppData((prev) => ({
        financialRecords: prev.financialRecords.filter((record) => record.id !== recordId),
      }));
      setFinancialRecordModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении записи');
      throw err;
    }
  };

  const handleLogout = () => {
    clearTokens();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAppData({
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
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">
          {authLoading ? 'Загрузка...' : 'Загрузка данных...'}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={async () => {
          const userData = await getCurrentUser();
          const user = mapApiUser(userData);
          setCurrentUser(user);
          setIsAuthenticated(true);
          await loadData();
        }}
      />
    );
  }

  return (
    <MainLayout
      onAddDeal={() => setModal('deal')}
      onAddClient={() => openClientModal()}
      currentUser={currentUser || undefined}
      onLogout={handleLogout}
    >
      <AppRoutes
        deals={deals}
        clients={clients}
        onClientEdit={handleClientEditRequest}
        onClientDelete={handleClientDeleteRequest}
        onClientMerge={handleClientMergeRequest}
        policies={policies}
        payments={payments}
        financialRecords={financialRecords}
        tasks={tasks}
        users={users}
        currentUser={currentUser}
        selectedDealId={selectedDealId}
        onSelectDeal={setSelectedDealId}
        onCloseDeal={handleCloseDeal}
        onReopenDeal={handleReopenDeal}
        onUpdateDeal={handleUpdateDeal}
        onRequestAddQuote={(dealId) => setQuoteDealId(dealId)}
        onRequestEditQuote={handleRequestEditQuote}
        onRequestAddPolicy={handleRequestAddPolicy}
        onRequestEditPolicy={handleRequestEditPolicy}
        onDeleteQuote={handleDeleteQuote}
        onDeletePolicy={handleDeletePolicy}
        onAddPayment={handleAddPayment}
        onUpdatePayment={handleUpdatePayment}
        onAddFinancialRecord={handleAddFinancialRecord}
        onUpdateFinancialRecord={handleUpdateFinancialRecord}
        onDeleteFinancialRecord={handleDeleteFinancialRecord}
        onDriveFolderCreated={handleDriveFolderCreated}
        onFetchChatMessages={handleFetchChatMessages}
        onSendChatMessage={handleSendChatMessage}
        onDeleteChatMessage={handleDeleteChatMessage}
        onFetchDealHistory={fetchDealHistory}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onDeleteTask={handleDeleteTask}
        onDeleteDeal={handleDeleteDeal}
        onRestoreDeal={handleRestoreDeal}
        onMergeDeals={handleMergeDeals}
        dealSearch={dealSearch}
        onDealSearchChange={setDealSearch}
        dealExecutorFilter={dealExecutorFilter}
        onDealExecutorFilterChange={setDealExecutorFilter}
        dealSourceFilter={dealSourceFilter}
        onDealSourceFilterChange={setDealSourceFilter}
        dealExpectedCloseFrom={dealExpectedCloseFrom}
        onDealExpectedCloseFromChange={setDealExpectedCloseFrom}
        dealExpectedCloseTo={dealExpectedCloseTo}
        onDealExpectedCloseToChange={setDealExpectedCloseTo}
        dealShowDeleted={dealShowDeleted}
        onDealShowDeletedChange={setDealShowDeleted}
        onPolicyDraftReady={handlePolicyDraftReady}
        knowledgeDocs={knowledgeDocs}
        knowledgeLoading={knowledgeLoading}
        knowledgeUploading={knowledgeUploading}
        knowledgeError={knowledgeError}
        handleKnowledgeUpload={handleKnowledgeUpload}
        onLoadMoreDeals={loadMoreDeals}
        dealsHasMore={dealsHasMore}
        isLoadingMoreDeals={isLoadingMoreDeals}
      />


      <AppModals
        modal={modal}
        setModal={setModal}
        openClientModal={openClientModal}
        closeClientModal={closeClientModal}
        clients={clients}
        users={users}
        handleAddClient={handleAddClient}
        handleAddDeal={handleAddDeal}
        quoteDealId={quoteDealId}
        setQuoteDealId={setQuoteDealId}
        handleAddQuote={handleAddQuote}
        editingQuote={editingQuote}
        setEditingQuote={setEditingQuote}
        handleUpdateQuote={handleUpdateQuote}
        policyDealId={policyDealId}
        policyDefaultCounterparty={policyDefaultCounterparty}
        closePolicyModal={closePolicyModal}
        policyPrefill={policyPrefill}
        editingPolicy={editingPolicy}
        setEditingPolicy={setEditingPolicy}
        salesChannels={salesChannels}
        handleAddPolicy={handleAddPolicy}
        handleUpdatePolicy={handleUpdatePolicy}
        paymentModal={paymentModal}
        setPaymentModal={setPaymentModal}
        handleUpdatePayment={handleUpdatePayment}
        payments={payments}
        financialRecordModal={financialRecordModal}
        setFinancialRecordModal={setFinancialRecordModal}
          handleUpdateFinancialRecord={handleUpdateFinancialRecord}
          financialRecords={financialRecords}
        />
      {editingClient && (
        <Modal title="Редактировать клиента" onClose={() => setEditingClient(null)}>
          <ClientForm
            initial={{
              name: editingClient.name,
              phone: editingClient.phone ?? '',
              email: editingClient.email ?? '',
              birthDate: editingClient.birthDate ?? '',
              notes: editingClient.notes ?? '',
            }}
            onSubmit={handleUpdateClient}
          />
        </Modal>
      )}
      {clientDeleteTarget && (
        <Modal
          title="Удалить клиента"
          onClose={() => setClientDeleteTarget(null)}
          closeOnOverlayClick={false}
        >
          <p className="text-sm text-slate-700">
            Клиент <span className="font-bold">{clientDeleteTarget.name}</span> и все его данные станут недоступны.
          </p>
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setClientDeleteTarget(null)}
              className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              disabled={isSyncing}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleDeleteClient}
              className="px-3 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSyncing}
            >
              {isSyncing ? 'Удаляем...' : 'Удалить'}
            </button>
          </div>
        </Modal>
      )}
      {mergeTargetClient && (
        <Modal title={`Объединить клиента ${mergeTargetClient.name}`} onClose={closeMergeModal} size="lg">
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              Выберите клиентов, которые будут объединены в «{mergeTargetClient.name}».
            </p>
            <input
              type="search"
              value={mergeSearch}
              onChange={(event) => setMergeSearch(event.target.value)}
              placeholder="Поиск по имени клиента"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
            />
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {mergeCandidates.length ? (
                mergeCandidates.map((client) => (
                  <label
                    key={client.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:border-slate-300 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={mergeSources.includes(client.id)}
                      onChange={() => toggleMergeSource(client.id)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{client.name}</p>
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  {!mergeSearch
                    ? 'Нет доступных клиентов для объединения.'
                    : `По запросу "${mergeSearch}" ничего не найдено.`}
                </p>
              )}
            </div>
            {mergeError && <p className="text-sm text-rose-600">{mergeError}</p>}
          </div>
          <div className="flex items-center justify-end gap-3 mt-6 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={closeMergeModal}
              className="px-3 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
              disabled={isMergingClients}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleMergeSubmit}
              disabled={isMergingClients || !mergeSources.length}
              className="px-3 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isMergingClients ? 'Объединяем...' : 'Объединить клиентов'}
            </button>
          </div>
        </Modal>
      )}
      <NotificationDisplay />

      {error && (
        <div className="fixed bottom-4 left-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 max-w-md shadow-lg">
          <strong className="font-bold">Ошибка!</strong>
          <span className="block sm:inline"> {error}</span>
          <button className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
            <span className="text-2xl">&times;</span>
          </button>
        </div>
      )}

      {isSyncing && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
          <span className="text-sm font-medium">Синхронизация...</span>
        </div>
      )}
    </MainLayout>
  );
};

export default AppContent;
