import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { LoginPage } from './components/LoginPage';
import { useNotification } from './contexts/NotificationContext';
import { NotificationDisplay } from './components/NotificationDisplay';
import { AppModals } from './components/app/AppModals';
import { AppRoutes } from './components/app/AppRoutes';
import { ClientForm } from './components/forms/ClientForm';
import type { AddTaskFormValues } from './components/forms/AddTaskForm';
import type { DealFormValues } from './components/forms/DealForm';
import type { QuoteFormValues } from './components/forms/AddQuoteForm';
import { Modal } from './components/Modal';
import { formatErrorMessage } from './utils/formatErrorMessage';
import { markTaskAsDeleted } from './utils/tasks';
import {
  createClient,
  updateClient,
  deleteClient,
  mergeClients,
  createDeal,
  createQuote,
  updateQuote,
  deleteQuote,
  deleteDeal,
  restoreDeal,
  fetchChatMessages,
  createChatMessage,
  deleteChatMessage,
  closeDeal,
  reopenDeal,
  updateDeal,
  mergeDeals,
  fetchDealHistory,
  fetchTasksByDeal,
  fetchQuotesByDeal,
  createTask,
  updateTask,
  deleteTask,
  getCurrentUser,
  hasStoredTokens,
  clearTokens,
  APIError,
  uploadKnowledgeDocument,
  deleteKnowledgeDocument,
  syncKnowledgeDocument,
  fetchDeal,
  createPolicy,
  updatePolicy,
  deletePolicy,
  createPayment,
  updatePayment,
  createFinancialRecord,
  updateFinancialRecord,
  deleteFinancialRecord,
} from './api';
import type { CurrentUserResponse, FilterParams } from './api';
import { Client, Deal, FinancialRecord, Payment, Policy, Quote, SalesChannel, User } from './types';
import { useAppData } from './hooks/useAppData';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useDealFilters } from './hooks/useDealFilters';
import type { AddPaymentFormValues } from './components/forms/AddPaymentForm';
import type { AddFinancialRecordFormValues } from './components/forms/AddFinancialRecordForm';
import type { PolicyFormValues } from './components/forms/addPolicy/types';
import type { ModalType } from './components/app/types';
import type { FinancialRecordModalState, PaymentModalState } from './types';
import { normalizePaymentDraft } from './utils/normalizePaymentDraft';
import { markQuoteAsDeleted } from './utils/quotes';
import { parseNumericAmount } from './utils/parseNumericAmount';
import { buildPolicyDraftFromRecognition, normalizeStringValue } from './utils/policyRecognition';
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

const parseAmountValue = (value?: string | null) => {
  const parsed = parseNumericAmount(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatAmountValue = (value: number) => value.toFixed(2);

const matchSalesChannel = (channels: SalesChannel[], recognizedValue: string): SalesChannel | undefined => {
  const normalizedValue = recognizedValue.trim().toLowerCase();
  if (!normalizedValue) {
    return undefined;
  }
  return channels.find((channel) => {
    const channelName = channel.name.toLowerCase();
    if (channelName === normalizedValue) {
      return true;
    }
    if (channelName.includes(normalizedValue) || normalizedValue.includes(channelName)) {
      return true;
    }
    const normalizedTokens = normalizedValue.split(/\s+/).filter(Boolean);
    const channelTokens = channelName.split(/\s+/).filter(Boolean);
    if (normalizedTokens.some((token) => channelTokens.some((channelToken) => channelToken.includes(token)))) {
      return true;
    }
    if (channelTokens.some((token) => normalizedValue.includes(token))) {
      return true;
    }
    return false;
  });
};

const AppContent: React.FC = () => {
  const { addNotification } = useNotification();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [modal, setModal] = useState<ModalType>(null);
  const [isClientModalOverlayOpen, setClientModalOverlayOpen] = useState(false);
  const [clientModalReturnTo, setClientModalReturnTo] = useState<ModalType | null>(null);
  const [pendingDealClientId, setPendingDealClientId] = useState<string | null>(null);
  const openClientModal = (afterModal: ModalType | null = null) => {
    if (afterModal) {
      setClientModalOverlayOpen(true);
      setClientModalReturnTo(afterModal);
      return;
    }
    setClientModalReturnTo(null);
    setModal('client');
  };

  const closeClientModal = useCallback(() => {
    if (isClientModalOverlayOpen) {
      setClientModalOverlayOpen(false);
      setClientModalReturnTo(null);
      return;
    }
    setModal(null);
  }, [isClientModalOverlayOpen, setModal, setClientModalReturnTo]);
  const [quoteDealId, setQuoteDealId] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [policyDealId, setPolicyDealId] = useState<string | null>(null);
  const [policyPrefill, setPolicyPrefill] = useState<{
    values: PolicyFormValues;
    insuranceCompanyName?: string;
    insuranceTypeName?: string;
  } | null>(null);
  const [policyDefaultCounterparty, setPolicyDefaultCounterparty] = useState<string | undefined>(undefined);
  const [policySourceFileIds, setPolicySourceFileIds] = useState<string[]>([]);

  const closePolicyModal = useCallback(() => {
    setPolicyDealId(null);
    setPolicyPrefill(null);
    setPolicyDefaultCounterparty(undefined);
    setPolicySourceFileIds([]);
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
    invalidateDealsCache,
    refreshPolicies,
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
    dealShowDeleted,
    setDealShowDeleted,
    dealShowClosed,
    setDealShowClosed,
    dealOrdering,
    setDealOrdering,
    filters: dealFilters,
  } = useDealFilters();
  const dealsById = useMemo(() => {
    const map = new Map<string, Deal>();
    deals.forEach((deal) => {
      map.set(deal.id, deal);
    });
    return map;
  }, [deals]);
  const getDealExecutorName = useCallback(
    (dealId: string | null) =>
      dealId ? dealsById.get(dealId)?.executorName ?? null : null,
    [dealsById]
  );
  const policyDealExecutorName = getDealExecutorName(policyDealId);
  const editingPolicyExecutorName = getDealExecutorName(editingPolicy?.dealId ?? null);
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

  const syncDealsByIds = useCallback(
    async (dealIds: (string | null | undefined)[]) => {
      const normalizedIds = Array.from(
        new Set(dealIds.filter((id): id is string => Boolean(id)))
      );
      if (!normalizedIds.length) {
        return;
      }
      const fetchedDeals = await Promise.all(
        normalizedIds.map((dealId) => fetchDeal(dealId))
      );
      updateAppData((prev) => {
        const dealMap = new Map<string, Deal>(fetchedDeals.map((deal) => [deal.id, deal]));
        const existingIds = new Set(prev.deals.map((deal) => deal.id));
        const updatedDeals = prev.deals.map((deal) => dealMap.get(deal.id) ?? deal);
        const missingDeals = fetchedDeals.filter((deal) => !existingIds.has(deal.id));
        return { deals: [...updatedDeals, ...missingDeals] };
      });
      invalidateDealsCache();
    },
    [invalidateDealsCache, updateAppData]
  );

  const adjustPaymentsTotals = useCallback(
    <T extends { id: string; paymentsTotal?: string | null; paymentsPaid?: string | null }>(
      items: T[],
      targetId: string | undefined | null,
      totalDelta: number,
      paidDelta: number
    ) => {
      if (!targetId) {
        return items;
      }
      const normalizedTotalDelta = Number.isFinite(totalDelta) ? totalDelta : 0;
      const normalizedPaidDelta = Number.isFinite(paidDelta) ? paidDelta : 0;
      if (normalizedTotalDelta === 0 && normalizedPaidDelta === 0) {
        return items;
      }
      return items.map((item) => {
        if (item.id !== targetId) {
          return item;
        }
        const currentTotal = parseAmountValue(item.paymentsTotal);
        const currentPaid = parseAmountValue(item.paymentsPaid);
        return {
          ...item,
          paymentsTotal: formatAmountValue(currentTotal + normalizedTotalDelta),
          paymentsPaid: formatAmountValue(currentPaid + normalizedPaidDelta),
        };
      });
    },
    []
  );

  const handlePolicyDraftReady = useCallback(
    (
      dealId: string,
      parsed: Record<string, unknown>,
      _fileName?: string | null,
      fileId?: string | null,
      parsedFileIds?: string[]
    ) => {
      if (!parsed) {
        return;
      }
      const draft = buildPolicyDraftFromRecognition(parsed);
      const policyObj = (parsed.policy ?? {}) as Record<string, unknown>;
      const recognizedSalesChannel = normalizeStringValue(
        policyObj.sales_channel ??
          policyObj.sales_channel_name ??
          policyObj.salesChannel ??
          policyObj.salesChannelName
      );
      const matchedChannel = matchSalesChannel(salesChannels, recognizedSalesChannel);

      const recognizedInsuredName = normalizeStringValue(
        parsed.insured_client_name ??
          parsed.client_name ??
          policyObj.insured_client_name ??
          policyObj.client_name ??
          policyObj.client ??
          policyObj.insured_client ??
          policyObj.contractor
      );
      const matchedInsuredClient =
        recognizedInsuredName?.length
          ? clients.find(
              (client) => client.name.toLowerCase() === recognizedInsuredName.toLowerCase()
            )
          : undefined;

      const values = {
        ...draft,
        salesChannelId: matchedChannel?.id,
        insuredClientId: matchedInsuredClient?.id ?? undefined,
        insuredClientName:
          matchedInsuredClient?.name ??
          (recognizedInsuredName || undefined),
      };
      const recognizedInsuranceType = normalizeStringValue(
        policyObj.insurance_type ??
          policyObj.insuranceType ??
          parsed.insurance_type ??
          parsed.insuranceType
      );
      setPolicyDealId(dealId);
      setPolicyDefaultCounterparty(undefined);
      const resolvedFileIds = parsedFileIds?.length
        ? Array.from(
            new Set(parsedFileIds.filter((id): id is string => Boolean(id)))
          )
        : fileId
        ? [fileId]
        : [];
      setPolicySourceFileIds(resolvedFileIds);
      setPolicyPrefill({
        values,
        insuranceCompanyName: normalizeStringValue(policyObj.insurance_company),
        insuranceTypeName: recognizedInsuranceType,
      });
    },
    [salesChannels, clients]
  );

  const handleRequestAddPolicy = useCallback((dealId: string) => {
    setPolicyDefaultCounterparty(undefined);
    setPolicyPrefill(null);
    setPolicySourceFileIds([]);
    setPolicyDealId(dealId);
  }, []);

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
      setError(formatErrorMessage(err, 'Ошибка при поиске сделок'));
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

  const handleAddClient = useCallback(
    async (data: {
      name: string;
      phone?: string;
      birthDate?: string | null;
      notes?: string | null;
      email?: string | null;
    }) => {
      const created = await createClient(data);
      updateAppData((prev) => ({ clients: [created, ...prev.clients] }));
      if (clientModalReturnTo === 'deal') {
        setPendingDealClientId(created.id);
      }
      closeClientModal();
    },
    [closeClientModal, updateAppData, clientModalReturnTo]
  );

  const handlePendingDealClientConsumed = useCallback(() => {
    setPendingDealClientId(null);
  }, []);

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
        setError(formatErrorMessage(err, 'Ошибка при обновлении клиента'));
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
          setError(formatErrorMessage(err, 'Ошибка при удалении клиента'));
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
          const insuredClientId = policy.insuredClientId ?? '';
          const shouldUpdatePrimary = Boolean(policyClientId && mergedIds.has(policyClientId));
          const shouldUpdateInsured = Boolean(
            insuredClientId && mergedIds.has(insuredClientId)
          );
          if (!shouldUpdatePrimary && !shouldUpdateInsured) {
            return policy;
          }
          return {
            ...policy,
            clientId: shouldUpdatePrimary ? result.targetClient.id : policy.clientId,
            clientName: shouldUpdatePrimary ? result.targetClient.name : policy.clientName,
            insuredClientId: shouldUpdateInsured
              ? result.targetClient.id
              : policy.insuredClientId,
            insuredClientName: shouldUpdateInsured
              ? result.targetClient.name
              : policy.insuredClientName,
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

  const handleAddDeal = useCallback(
    async (data: DealFormValues) => {
      invalidateDealsCache();
      const created = await createDeal({
        title: data.title,
        clientId: data.clientId,
        description: data.description,
        expectedClose: data.expectedClose,
        executorId: data.executorId,
        source: data.source?.trim() || undefined,
      });
      updateAppData((prev) => ({ deals: [created, ...prev.deals] }));
      setSelectedDealId(created.id);
      setModal(null);
    },
    [invalidateDealsCache, setModal, setSelectedDealId, updateAppData]
  );

  const handleKnowledgeUpload = useCallback(
    async (
      file: File,
      metadata: { title?: string; description?: string; insuranceTypeId?: string }
    ) => {
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

  const handleKnowledgeDelete = useCallback(
    async (documentId: string) => {
      try {
        await deleteKnowledgeDocument(documentId);
        updateAppData((prev) => ({
          knowledgeDocs: prev.knowledgeDocs.filter((doc) => doc.id !== documentId),
        }));
      } catch (err) {
        const message =
          err instanceof Error
            ? err
            : new Error('Ошибка при удалении документа');
        throw message;
      }
    },
    [updateAppData]
  );

  const handleKnowledgeSync = useCallback(
    async (documentId: string) => {
      try {
        const updated = await syncKnowledgeDocument(documentId);
        updateAppData((prev) => ({
          knowledgeDocs: prev.knowledgeDocs.map((doc) =>
            doc.id === updated.id ? updated : doc
          ),
        }));
      } catch (err) {
        const message =
          err instanceof Error
            ? err
            : new Error('Ошибка при синхронизации документа');
        throw message;
      }
    },
    [updateAppData]
  );

  const handleCloseDeal = useCallback(
    async (
      dealId: string,
      payload: { reason: string; status?: 'won' | 'lost' }
    ) => {
      invalidateDealsCache();
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
    },
    [invalidateDealsCache, setError, setIsSyncing, updateAppData]
  );

  const handleReopenDeal = useCallback(
    async (dealId: string) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        const updated = await reopenDeal(dealId);
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) => (deal.id === updated.id ? updated : deal)),
        }));
        setSelectedDealId(updated.id);
      } catch (err) {
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при восстановлении сделки', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Ошибка при восстановлении сделки'));
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [
      addNotification,
      invalidateDealsCache,
      setError,
      setIsSyncing,
      setSelectedDealId,
      updateAppData,
    ]
  );

  const handleUpdateDeal = useCallback(
    async (dealId: string, data: DealFormValues) => {
      invalidateDealsCache();
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
          setError(formatErrorMessage(err, 'Ошибка при обновлении сделки'));
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, invalidateDealsCache, setError, setIsSyncing, setSelectedDealId, updateAppData]
  );

  const handlePostponeDeal = useCallback(
    async (dealId: string, data: DealFormValues) => {
      invalidateDealsCache();
      const previousSelection = selectedDealId;
      setIsSyncing(true);
      try {
        await updateDeal(dealId, data);
        const refreshed = await refreshDeals(dealFilters, { force: true });
        setSelectedDealId(refreshed[0]?.id ?? null);
      } catch (err) {
        setSelectedDealId(previousSelection);
        if (err instanceof APIError && err.status === 403) {
          addNotification('?????? ??????? ??? ?????????? ??????', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, '?? ??????? ???????? ??????'));
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      addNotification,
      dealFilters,
      invalidateDealsCache,
      refreshDeals,
      selectedDealId,
      setError,
      setIsSyncing,
      setSelectedDealId,
    ]
  );
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
          setError(formatErrorMessage(err, 'Не удалось удалить сделку'));
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
          setError(formatErrorMessage(err, 'Не удалось восстановить сделку'));
        }
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, dealFilters, refreshDealsWithSelection, setError, setSelectedDealId, setIsSyncing]
  );

  const handleMergeDeals = useCallback(
    async (targetDealId: string, sourceDealIds: string[], resultingClientId?: string) => {
      invalidateDealsCache();
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
        setError(formatErrorMessage(err, 'Ошибка объединения сделок'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, invalidateDealsCache, setError, setSelectedDealId, setIsSyncing, updateAppData]
  );

  const handleAddQuote = useCallback(
    async (dealId: string, values: QuoteFormValues) => {
      invalidateDealsCache();
      try {
        const created = await createQuote({ dealId, ...values });
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId ? { ...deal, quotes: [created, ...(deal.quotes ?? [])] } : deal
          ),
        }));
        setQuoteDealId(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при добавлении предложения'));
        throw err;
      }
    },
    [invalidateDealsCache, setError, setQuoteDealId, updateAppData]
  );

  const handleUpdateQuote = useCallback(
    async (values: QuoteFormValues) => {
      if (!editingQuote) {
        return;
      }
      invalidateDealsCache();
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
        setError(formatErrorMessage(err, 'Ошибка при обновлении предложения'));
        throw err;
      }
    },
    [editingQuote, invalidateDealsCache, setEditingQuote, setError, updateAppData]
  );

  const handleRequestEditQuote = useCallback((quote: Quote) => {
    setEditingQuote(quote);
  }, []);

  const handleDeleteQuote = useCallback(
    async (dealId: string, quoteId: string) => {
      invalidateDealsCache();
      try {
        await deleteQuote(quoteId);
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId
              ? { ...deal, quotes: markQuoteAsDeleted(deal.quotes ?? [], quoteId) }
              : deal
          ),
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении предложения'));
        throw err;
      }
    },
    [invalidateDealsCache, setError, updateAppData]
  );

  const handleAddPolicy = useCallback(
    async (dealId: string, values: PolicyFormValues) => {
      invalidateDealsCache();
      setIsSyncing(true);
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
        insuredClientId,
        counterparty,
        payments: paymentDrafts = [],
      } = values;
      const sourceFileIds = policySourceFileIds;
      const sourceFileId = sourceFileIds[0];
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
          setError(formatErrorMessage(err, 'Ошибка при получении сделки'));
          throw err;
        }
      }

      try {
        const created = await createPolicy({
          dealId,
          clientId,
          insuredClientId,
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
          sourceFileIds: sourceFileIds.length ? sourceFileIds : undefined,
        });
        updateAppData((prev) => ({ policies: [created, ...prev.policies] }));
        const parsePolicyAmount = (value?: string | null) => {
          const parsed = parseNumericAmount(value ?? '');
          return Number.isFinite(parsed) ? parsed : 0;
        };
        let policyPaymentsTotal = parsePolicyAmount(created.paymentsTotal);
        let policyPaymentsPaid = parsePolicyAmount(created.paymentsPaid);
        const formatPolicyAmount = (value: number) => value.toFixed(2);
        const syncPolicyTotals = () => {
          const formattedTotal = formatPolicyAmount(policyPaymentsTotal);
          const formattedPaid = formatPolicyAmount(policyPaymentsPaid);
          updateAppData((prev) => ({
            policies: prev.policies.map((policy) =>
              policy.id === created.id
                ? {
                    ...policy,
                    paymentsTotal: formattedTotal,
                    paymentsPaid: formattedPaid,
                  }
                : policy
            ),
          }));
        };

        const hasCounterparty = Boolean(counterparty?.trim());
        const executorName = deal?.executorName?.trim();
        const hasExecutor = Boolean(executorName);
        const ensureExpenses = hasCounterparty || hasExecutor;
        const expenseTargetName =
          counterparty?.trim() || executorName || 'контрагент';
        const expenseNote = `Расход контрагенту ${expenseTargetName}`;
        const paymentsToProcess = paymentDrafts.map((payment) =>
          normalizePaymentDraft(payment, ensureExpenses, {
            autoIncomeNote: 'ожидаемое КВ',
            autoExpenseNote: ensureExpenses ? expenseNote : undefined,
          })
        );

        let dealPaymentsTotalDelta = 0;
        let dealPaymentsPaidDelta = 0;

        for (const paymentDraft of paymentsToProcess) {
          const amount = parseNumericAmount(paymentDraft.amount);
          if (!Number.isFinite(amount) || amount < 0) {
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
            const incomeAmount = parseNumericAmount(income.amount);
            if (!Number.isFinite(incomeAmount) || incomeAmount < 0) {
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
            const expenseAmount = parseNumericAmount(expense.amount);
            if (!Number.isFinite(expenseAmount) || expenseAmount < 0) {
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
          policyPaymentsTotal += amount;
          if (payment.actualDate) {
            policyPaymentsPaid += amount;
            dealPaymentsPaidDelta += amount;
          }
          dealPaymentsTotalDelta += amount;
          syncPolicyTotals();
          updateAppData((prev) => ({
            payments: [paymentWithRecords, ...prev.payments],
            financialRecords:
              createdRecords.length > 0
                ? [...createdRecords, ...prev.financialRecords]
                : prev.financialRecords,
          }));
        }

        if (dealPaymentsTotalDelta || dealPaymentsPaidDelta) {
          updateAppData((prev) => ({
            deals: adjustPaymentsTotals(
              prev.deals,
              dealId,
              dealPaymentsTotalDelta,
              dealPaymentsPaidDelta
            ),
          }));
        }

        let refreshFailed = false;
        try {
          const refreshedDeal = await fetchDeal(dealId);
          updateAppData((prev) => ({
            deals: prev.deals.some((deal) => deal.id === refreshedDeal.id)
              ? prev.deals.map((deal) =>
                  deal.id === refreshedDeal.id ? refreshedDeal : deal
                )
              : [refreshedDeal, ...prev.deals],
          }));
          setSelectedDealId(refreshedDeal.id);
        } catch (refreshErr) {
          setError(
            refreshErr instanceof Error
              ? refreshErr.message
              : 'Не удалось обновить данные сделки'
          );
          refreshFailed = true;
        }

        try {
          await refreshPolicies();
        } catch (refreshErr) {
          setError(
            refreshErr instanceof Error
              ? refreshErr.message
              : 'Не удалось обновить список полисов'
          );
          refreshFailed = true;
        }
        try {
          await refreshDealsWithSelection(dealFilters, { force: true });
        } catch (refreshErr) {
          setError(
            refreshErr instanceof Error
              ? refreshErr.message
              : 'Не удалось обновить список сделок'
          );
          refreshFailed = true;
        }

        if (!refreshFailed) {
          closePolicyModal();
        }
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось сохранить полис'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      adjustPaymentsTotals,
      closePolicyModal,
      dealFilters,
      dealsById,
      invalidateDealsCache,
      policySourceFileIds,
      refreshDealsWithSelection,
      refreshPolicies,
      setError,
      setIsSyncing,
      setSelectedDealId,
      updateAppData,
    ]
  );
  const handleRequestEditPolicy = useCallback(
    (policy: Policy) => {
      setModal(null);
      closePolicyModal();
      setEditingPolicy(policy);
    },
    [closePolicyModal, setModal]
  );
  const handleUpdatePolicy = useCallback(
    async (policyId: string, values: PolicyFormValues) => {
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
          insuredClientId,
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
          insuredClientId,
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
    },
    [setEditingPolicy, setError, setIsSyncing, updateAppData]
  );
  const handleDeletePolicy = useCallback(
    async (policyId: string) => {
      try {
        await deletePolicy(policyId);
        updateAppData((prev) => {
          const removedPaymentIds = new Set<string>();
          const remainingPayments = prev.payments.filter((payment) => {
            const shouldRemove = payment.policyId === policyId;
            if (shouldRemove) {
              removedPaymentIds.add(payment.id);
            }
            return !shouldRemove;
          });
          return {
            policies: prev.policies.filter((policy) => policy.id !== policyId),
            payments: remainingPayments,
            financialRecords: prev.financialRecords.filter(
              (record) => !removedPaymentIds.has(record.paymentId)
            ),
          };
        });
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось удалить полис'));
        throw err;
      }
    },
    [setError, updateAppData]
  );

  const handleDriveFolderCreated = useCallback(
    (dealId: string, folderId: string) => {
      invalidateDealsCache();
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) =>
          deal.id === dealId ? { ...deal, driveFolderId: folderId } : deal
        ),
      }));
    },
    [invalidateDealsCache, updateAppData]
  );
  const handleFetchChatMessages = useCallback(
    async (dealId: string) => {
      try {
        return await fetchChatMessages(dealId);
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось загрузить сообщения'));
        throw err;
      }
    },
    [setError]
  );

  const handleSendChatMessage = useCallback(
    async (dealId: string, body: string) => {
      try {
        return await createChatMessage(dealId, body);
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось отправить сообщение'));
        throw err;
      }
    },
    [setError]
  );

  const handleDeleteChatMessage = useCallback(
    async (messageId: string) => {
      try {
        await deleteChatMessage(messageId);
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось удалить сообщение'));
        throw err;
      }
    },
    [setError]
  );

  const handleCreateTask = useCallback(
    async (dealId: string, data: AddTaskFormValues) => {
      setIsSyncing(true);
      try {
        const created = await createTask({ dealId, ...data });
        updateAppData((prev) => ({ tasks: [created, ...prev.tasks] }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при создании задачи'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [setError, setIsSyncing, updateAppData]
  );

  const handleUpdateTask = useCallback(
    async (taskId: string, data: Partial<AddTaskFormValues>) => {
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
          setError(formatErrorMessage(err, 'Ошибка при обновлении задачи'));
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, setError, setIsSyncing, updateAppData]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      try {
        await deleteTask(taskId);
        updateAppData((prev) => ({ tasks: markTaskAsDeleted(prev.tasks, taskId) }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении задачи'));
        throw err;
      }
    },
    [setError, updateAppData]
  );

  const loadDealTasks = useCallback(
    async (dealId: string) => {
      try {
        const dealTasks = await fetchTasksByDeal(dealId, { showDeleted: true });
        updateAppData((prev) => ({
          tasks: [
            ...prev.tasks.filter((task) => task.dealId !== dealId),
            ...dealTasks,
          ],
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Error loading tasks for the deal'));
      }
    },
    [setError, updateAppData]
  );

  const loadDealQuotes = useCallback(
    async (dealId: string) => {
      try {
        const dealQuotes = await fetchQuotesByDeal(dealId, { showDeleted: true });
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId ? { ...deal, quotes: dealQuotes } : deal
          ),
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Error loading quotes for the deal'));
      }
    },
    [setError, updateAppData]
  );

  useEffect(() => {
    if (!selectedDealId || !isAuthenticated) {
      return;
    }
    void loadDealTasks(selectedDealId);
    void loadDealQuotes(selectedDealId);
  }, [isAuthenticated, loadDealQuotes, loadDealTasks, selectedDealId]);

  const handleAddPayment = useCallback(
    async (values: AddPaymentFormValues) => {
      invalidateDealsCache();
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

        const paymentAmount = parseAmountValue(created.amount);
        const paymentPaidAmount = created.actualDate ? paymentAmount : 0;
        updateAppData((prev) => ({
          payments: [created, ...prev.payments],
          financialRecords: [zeroIncome, ...prev.financialRecords],
          policies: adjustPaymentsTotals(
            prev.policies,
            created.policyId,
            paymentAmount,
            paymentPaidAmount
          ),
          deals: adjustPaymentsTotals(prev.deals, created.dealId, paymentAmount, paymentPaidAmount),
        }));
        try {
          await syncDealsByIds([created.dealId]);
        } catch (syncErr) {
          const baseMessage = 'Не удалось обновить данные сделки после создания платежа';
          const detail = formatErrorMessage(syncErr);
          const message = detail ? `${baseMessage}: ${detail}` : baseMessage;
          throw new Error(message);
        }
        setPaymentModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при создании платежа'));
        throw err;
      }
    },
    [adjustPaymentsTotals, invalidateDealsCache, setError, setPaymentModal, syncDealsByIds, updateAppData]
  );

  const handleUpdatePayment = useCallback(
    async (paymentId: string, values: AddPaymentFormValues) => {
      invalidateDealsCache();
      try {
        const previousPayment = payments.find((payment) => payment.id === paymentId);
        const previousAmount = parseAmountValue(previousPayment?.amount);
        const previousPaid = previousPayment?.actualDate ? previousAmount : 0;
        const previousPolicyId = previousPayment?.policyId;
        const previousDealId = previousPayment?.dealId;

        const updated = await updatePayment(paymentId, {
          policyId: values.policyId,
          dealId: values.dealId ?? undefined,
          amount: parseFloat(values.amount),
          description: values.description,
          scheduledDate: values.scheduledDate || null,
          actualDate: values.actualDate || null,
        });
        const updatedAmount = parseAmountValue(updated.amount);
        const updatedPaid = updated.actualDate ? updatedAmount : 0;
        updateAppData((prev) => {
          let policies = prev.policies;
          if (previousPolicyId && previousPolicyId === updated.policyId) {
            policies = adjustPaymentsTotals(
              policies,
              previousPolicyId,
              updatedAmount - previousAmount,
              updatedPaid - previousPaid
            );
          } else {
            if (previousPolicyId) {
              policies = adjustPaymentsTotals(
                policies,
                previousPolicyId,
                -previousAmount,
                -previousPaid
              );
            }
            if (updated.policyId) {
              policies = adjustPaymentsTotals(policies, updated.policyId, updatedAmount, updatedPaid);
            }
          }

          let deals = prev.deals;
          if (previousDealId && previousDealId === updated.dealId) {
            deals = adjustPaymentsTotals(
              deals,
              previousDealId,
              updatedAmount - previousAmount,
              updatedPaid - previousPaid
            );
          } else {
            if (previousDealId) {
              deals = adjustPaymentsTotals(deals, previousDealId, -previousAmount, -previousPaid);
            }
            if (updated.dealId) {
              deals = adjustPaymentsTotals(deals, updated.dealId, updatedAmount, updatedPaid);
            }
          }

          return {
            payments: prev.payments.map((payment) =>
              payment.id === updated.id ? updated : payment
            ),
            policies,
            deals,
          };
        });
        try {
          await syncDealsByIds([updated.dealId, previousDealId]);
        } catch (syncErr) {
          const baseMessage = 'Не удалось обновить данные сделки после изменения платежа';
          const detail = formatErrorMessage(syncErr);
          const message = detail ? `${baseMessage}: ${detail}` : baseMessage;
          throw new Error(message);
        }
        setPaymentModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении платежа'));
        throw err;
      }
    },
    [adjustPaymentsTotals, invalidateDealsCache, payments, setError, setPaymentModal, syncDealsByIds, updateAppData]
  );

  const normalizeFinancialRecordAmount = (values: AddFinancialRecordFormValues) => {
    const parsedAmount = parseFloat(values.amount);
    if (!Number.isFinite(parsedAmount)) {
      return parsedAmount;
    }
    return values.recordType === 'expense' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
  };

  const handleAddFinancialRecord = useCallback(
    async (values: AddFinancialRecordFormValues) => {
      const paymentId = values.paymentId || financialRecordModal?.paymentId;
      if (!paymentId) {
        return;
      }
      try {
        const created = await createFinancialRecord({
          paymentId: paymentId,
          amount: normalizeFinancialRecordAmount(values),
          date: values.date || null,
          description: values.description,
          source: values.source,
          note: values.note,
        });
        updateAppData((prev) => ({
          financialRecords: [created, ...prev.financialRecords],
          payments: prev.payments.map((payment) =>
            payment.id === created.paymentId
              ? {
                  ...payment,
                  financialRecords: [...(payment.financialRecords ?? []), created],
                }
              : payment
          ),
        }));
        setFinancialRecordModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при создании записи'));
        throw err;
      }
    },
    [financialRecordModal, setError, setFinancialRecordModal, updateAppData]
  );

  const handleUpdateFinancialRecord = useCallback(
    async (recordId: string, values: AddFinancialRecordFormValues) => {
      try {
        const updated = await updateFinancialRecord(recordId, {
          amount: normalizeFinancialRecordAmount(values),
          date: values.date || null,
          description: values.description,
          source: values.source,
          note: values.note,
        });
        updateAppData((prev) => ({
          financialRecords: prev.financialRecords.map((record) =>
            record.id === updated.id ? updated : record
          ),
          payments: prev.payments.map((payment) =>
            payment.id === updated.paymentId
              ? {
                  ...payment,
                  financialRecords: (payment.financialRecords ?? []).map((record) =>
                    record.id === updated.id ? updated : record
                  ),
                }
              : payment
          ),
        }));
        setFinancialRecordModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении записи'));
        throw err;
      }
    },
    [setError, setFinancialRecordModal, updateAppData]
  );

  const handleDeleteFinancialRecord = useCallback(
    async (recordId: string) => {
      try {
        await deleteFinancialRecord(recordId);
        updateAppData((prev) => {
          const existing = prev.financialRecords.find((record) => record.id === recordId);
          return {
            financialRecords: prev.financialRecords.filter((record) => record.id !== recordId),
            payments: existing
              ? prev.payments.map((payment) =>
                  payment.id === existing.paymentId
                    ? {
                        ...payment,
                        financialRecords: (payment.financialRecords ?? []).filter(
                          (record) => record.id !== recordId
                        ),
                      }
                    : payment
                )
              : prev.payments,
          };
        });
        setFinancialRecordModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении записи'));
        throw err;
      }
    },
    [setError, setFinancialRecordModal, updateAppData]
  );

  const handleLogout = useCallback(() => {
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
  }, [setAppData]);

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
        onPostponeDeal={handlePostponeDeal}
        onRequestAddQuote={(dealId) => setQuoteDealId(dealId)}
        onRequestEditQuote={handleRequestEditQuote}
        onRequestAddPolicy={handleRequestAddPolicy}
        onRequestEditPolicy={handleRequestEditPolicy}
        onRequestAddClient={() => openClientModal('deal')}
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
        dealShowDeleted={dealShowDeleted}
        onDealShowDeletedChange={setDealShowDeleted}
        dealShowClosed={dealShowClosed}
        onDealShowClosedChange={setDealShowClosed}
        dealOrdering={dealOrdering}
        onDealOrderingChange={setDealOrdering}
        onPolicyDraftReady={handlePolicyDraftReady}
        knowledgeDocs={knowledgeDocs}
        knowledgeLoading={knowledgeLoading}
        knowledgeUploading={knowledgeUploading}
        knowledgeError={knowledgeError}
        handleKnowledgeUpload={handleKnowledgeUpload}
        handleKnowledgeDelete={handleKnowledgeDelete}
        handleKnowledgeSync={handleKnowledgeSync}
        onLoadMoreDeals={loadMoreDeals}
        dealsHasMore={dealsHasMore}
        isLoadingMoreDeals={isLoadingMoreDeals}
      />


      <AppModals
        modal={modal}
        setModal={setModal}
        openClientModal={openClientModal}
        closeClientModal={closeClientModal}
        isClientModalOverlayOpen={isClientModalOverlayOpen}
        clients={clients}
        users={users}
        handleAddClient={handleAddClient}
        handleAddDeal={handleAddDeal}
        pendingDealClientId={pendingDealClientId}
        onPendingDealClientConsumed={handlePendingDealClientConsumed}
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
      policyDealExecutorName={policyDealExecutorName}
      editingPolicyExecutorName={editingPolicyExecutorName}
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
              className="btn btn-secondary rounded-xl"
              disabled={isSyncing}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleDeleteClient}
              className="btn btn-danger rounded-xl"
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
                      className="check"
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
              className="btn btn-secondary rounded-xl"
              disabled={isMergingClients}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleMergeSubmit}
              disabled={isMergingClients || !mergeSources.length}
              className="btn btn-primary rounded-xl"
            >
              {isMergingClients ? 'Объединяем...' : 'Объединить клиентов'}
            </button>
          </div>
        </Modal>
      )}
      <NotificationDisplay />

      {error && (
        <div className="fixed bottom-4 left-4 z-50 w-[min(420px,calc(100vw-2rem))]">
          <div className="rounded-2xl border border-rose-200 border-l-4 border-l-rose-500 bg-rose-50 text-rose-900 shadow-md">
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="space-y-1">
                <p className="text-sm font-semibold">Ошибка</p>
                <p className="text-sm leading-relaxed">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setError(null)}
                className="icon-btn h-8 w-8 text-rose-700 hover:bg-rose-100"
                aria-label="Скрыть ошибку"
                title="Скрыть"
              >
                &times;
              </button>
            </div>
          </div>
        </div>
      )}

      {isSyncing && (
        <div className="fixed bottom-4 right-4 z-50">
          <div className="app-panel flex items-center gap-3 px-4 py-3 shadow-md">
            <div className="animate-spin h-4 w-4 border-2 border-slate-300 border-t-sky-600 rounded-full" />
            <span className="text-sm font-semibold text-slate-700">Синхронизация...</span>
          </div>
        </div>
      )}
    </MainLayout>
  );
};

export default AppContent;
