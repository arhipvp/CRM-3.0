import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import {
  createDealEvent,
  deleteDealEvent,
  fetchDealEvents,
  fetchDealHistory,
  clearTokens,
  normalizeClientName,
  updateDealEvent,
} from '../../api';
import { preloadAppRoute } from '../../components/app/routeLoaders';
import type {
  AppRouteDataBundle,
  AppRouteDealsActions,
  AppRouteFilterState,
  AppRouteFinanceActions,
  AppRouteLoadingState,
} from '../../components/app/appRoutes.types';
import type { ModalType } from '../../components/app/types';
import { useNotification } from '../../contexts/NotificationContext';
import { useAppBootstrapShell } from '../../features/app/bootstrap-shell/useAppBootstrapShell';
import { useAppInteractionShell } from '../../features/app/interaction-shell/useAppInteractionShell';
import { useDealPreviewController } from '../../features/app/interaction-shell/useDealPreviewController';
import { useAppRouteShell } from '../../features/app/route-shell/useAppRouteShell';
import { useAppData } from '../useAppData';
import { useAuthBootstrap } from '../useAuthBootstrap';
import { useDealFilters } from '../useDealFilters';
import { useConfirm } from '../useConfirm';
import { useClientDuplicateHints } from '../useClientDuplicateHints';
import { resolveEffectiveSelectedDealId } from '../useSelectedDeal';
import type { Client, Quote, User } from '../../types';
import type { FinancialRecordModalState, PaymentModalState } from '../../types';
import { formatAmountValue, parseAmountValue } from '../../utils/appContent';
import { runAsyncUiAction } from '../../utils/uiAction';
import { useClientActions } from './useClientActions';
import { useDealActions } from './useDealActions';
import { useDealDetailsData } from './useDealDetailsData';
import { useFinanceActions } from './useFinanceActions';
import { usePolicyActions } from './usePolicyActions';

export const useAppContentController = () => {
  const { addNotification } = useNotification();
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [modal, setModal] = useState<ModalType>(null);
  const [quoteDealId, setQuoteDealId] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState | null>(null);
  const [financialRecordModal, setFinancialRecordModal] =
    useState<FinancialRecordModalState | null>(null);
  const [isDealSelectionBlocked, setDealSelectionBlocked] = useState(false);
  const [quickTaskDealId, setQuickTaskDealId] = useState<string | null>(null);
  const [isRefreshingDealsList, setIsRefreshingDealsList] = useState(false);
  const [dealEventsRefreshTokens, setDealEventsRefreshTokens] = useState<Record<string, number>>(
    {},
  );

  const {
    dataState,
    loadData,
    ensureCommissionsDataLoaded,
    ensureFinanceDataLoaded,
    ensureReferenceData,
    ensureSalesChannelsLoaded,
    ensureClientLoaded,
    ensureTasksLoaded,
    refreshDeals,
    invalidateDealsCache,
    refreshPolicies,
    refreshPoliciesList,
    updatePoliciesList,
    updateAppData,
    setAppData,
    resetPoliciesState,
    resetPoliciesListState,
    loadMoreDeals,
    dealsHasMore,
    dealsTotalCount,
    policiesList,
    policiesListError,
    loadMorePolicies,
    policiesHasMore,
    isPoliciesListLoading,
    isLoadingMorePolicies,
    isLoadingMoreDeals,
    isCommissionsDataLoading,
    hasCommissionsSnapshotLoaded,
    isFinanceDataLoading,
    hasFinanceSnapshotLoaded,
    isTasksLoading,
    tasksPage,
    tasksTotalCount,
    statementsTotalCount,
    statementsHasMore,
    isLoadingMoreStatements,
    loadMoreStatements,
    isSyncing,
    setIsSyncing,
    error,
    setError,
  } = useAppData();
  const {
    authLoading,
    currentUser,
    handleLoginSuccess,
    isAuthenticated,
    setCurrentUser,
    setIsAuthenticated,
  } = useAuthBootstrap(loadData);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    clients,
    deals,
    policies,
    salesChannels,
    payments,
    financialRecords,
    statements,
    tasks,
    users,
  } = dataState;
  const duplicateHintClients = useMemo(() => {
    if (location.pathname.startsWith('/clients')) {
      return clients;
    }
    const visibleClientIds = new Set([
      ...deals.map((deal) => deal.clientId),
      ...policiesList.flatMap((policy) => [policy.clientId, policy.insuredClientId]),
    ]);
    return clients.filter((client) => visibleClientIds.has(client.id));
  }, [clients, deals, location.pathname, policiesList]);
  const clientDuplicateHints = useClientDuplicateHints(duplicateHintClients);

  const {
    isClientModalOverlayOpen,
    pendingDealClientId,
    editingClient,
    setEditingClient,
    clientDeleteTarget,
    setClientDeleteTarget,
    similarClientTargetId,
    similarCandidates,
    isSimilarClientsLoading,
    similarClientsError,
    mergeTargetClient,
    mergeCandidates,
    mergeSearch,
    setMergeSearch,
    mergeSources,
    mergeError,
    isMergingClients,
    isClientMergePreviewLoading,
    clientMergePreview,
    isClientMergePreviewConfirmed,
    clientMergeStep,
    clientMergeFieldOverrides,
    setClientMergeFieldOverrides,
    clientMergeSession,
    similarTargetClient,
    openClientModal,
    closeClientModal,
    handleAddClient,
    handlePendingDealClientConsumed,
    handleClientEditRequest,
    handleUpdateClient,
    handleClientDeleteRequest,
    handleDeleteClient,
    handleClientMergeRequest,
    handleClientFindSimilarRequest,
    closeSimilarClientsModal,
    toggleMergeSource,
    closeMergeModal,
    handleClientMergePreview,
    handleMergeSubmit,
    handleClientMergeRetry,
    handleExcludeClientSimilarity,
    handleMergeFromSimilar,
  } = useClientActions({
    clients,
    setModal,
    setIsSyncing,
    setError,
    updateAppData,
    addNotification,
  });

  const dealPreview = useDealPreviewController();

  useEffect(() => {
    if (isAuthenticated) {
      void preloadAppRoute(location.pathname);
    }
  }, [isAuthenticated, location.pathname]);

  const {
    deepLinkedDealId,
    isClientsRoute,
    isDealsRoute,
    isPoliciesRoute,
    isTasksRoute,
    pendingPostLoginRedirect,
  } = useAppBootstrapShell({
    ensureCommissionsDataLoaded,
    ensureFinanceDataLoaded,
    ensureReferenceData,
    ensureSalesChannelsLoaded,
    ensureTasksLoaded,
    isAuthenticated,
    locationSearch: location.search,
    navigate,
    pathname: location.pathname,
    refreshPolicies,
    selectDealById: dealPreview.selectDealById,
    setError,
  });

  const {
    dealSearchInput,
    setDealSearchInput,
    applyDealSearch,
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

  const effectiveSelectedDealId = useMemo(
    () =>
      resolveEffectiveSelectedDealId({
        deals,
        selectedDealId: dealPreview.selectedDealId,
        isDealFocusCleared: dealPreview.isDealFocusCleared,
      }),
    [dealPreview.isDealFocusCleared, dealPreview.selectedDealId, deals],
  );

  const clientsById = useMemo(() => {
    const map = new Map<string, Client>();
    clients.forEach((client) => {
      map.set(client.id, client);
    });
    return map;
  }, [clients]);

  const usersById = useMemo(() => {
    const map = new Map<string, User>();
    users.forEach((user) => {
      map.set(user.id, user);
    });
    return map;
  }, [users]);

  const {
    dealsById,
    mergeDealWithHydratedQuotes,
    invalidateDealTasksCache,
    invalidateDealQuotesCache,
    invalidateDealPoliciesCache,
    cacheDealQuotes,
    refreshDealsWithSelection,
    syncDealsByIds,
    handleSelectDeal,
    handleOpenDealPreview,
    handleRefreshSelectedDeal,
    handleRefreshDealsList,
    loadDealPolicies,
    handleRefreshSelectedDealPolicies,
    handleRefreshPreviewDealPolicies,
    registerProtectedCreatedDeal,
    dealAccessMessage,
    clearDealAccessMessage,
    isSelectedDealTasksLoading,
    isSelectedDealQuotesLoading,
    isPreviewDealTasksLoading,
    isPreviewDealQuotesLoading,
  } = useDealDetailsData({
    deals,
    deepLinkedDealId,
    isAuthenticated,
    isDealsRoute,
    effectiveSelectedDealId,
    previewDealId: dealPreview.previewDealId,
    isDealSelectionBlocked,
    dealFilters,
    refreshDeals,
    invalidateDealsCache,
    updateAppData,
    setError,
    clearSelectedDealFocus: dealPreview.clearSelectedDealFocus,
    selectDealById: dealPreview.selectDealById,
    openDealPreviewById: dealPreview.handleOpenDealPreview,
    setIsRefreshingDealsList,
  });

  const previewDeal = dealPreview.previewDealId
    ? (dealsById.get(dealPreview.previewDealId) ?? null)
    : null;
  const previewClient = previewDeal ? (clientsById.get(previewDeal.clientId) ?? null) : null;
  const previewSellerUser = previewDeal ? usersById.get(previewDeal.seller ?? '') : undefined;
  const previewExecutorUser = previewDeal ? usersById.get(previewDeal.executor ?? '') : undefined;
  const quickTaskDeal = quickTaskDealId ? (dealsById.get(quickTaskDealId) ?? null) : null;
  const selectedDeal = effectiveSelectedDealId
    ? (dealsById.get(effectiveSelectedDealId) ?? null)
    : null;

  useEffect(() => {
    const missingClientIds = new Set<string>();
    for (const deal of [selectedDeal, previewDeal]) {
      if (deal?.clientId && !clientsById.has(deal.clientId)) {
        missingClientIds.add(deal.clientId);
      }
    }
    missingClientIds.forEach((clientId) => {
      void ensureClientLoaded(clientId).catch(() => undefined);
    });
  }, [clientsById, ensureClientLoaded, previewDeal, selectedDeal]);

  const handleClientOpenById = useCallback(
    async (clientId: string) => {
      try {
        const client = await ensureClientLoaded(clientId);
        if (!client) throw new Error('Клиент не найден');
        handleClientEditRequest(client);
      } catch (err) {
        addNotification(
          err instanceof Error ? err.message : 'Не удалось загрузить клиента',
          'error',
        );
        throw err;
      }
    },
    [addNotification, ensureClientLoaded, handleClientEditRequest],
  );

  const openDealCreateModal = useCallback(() => {
    setModal('deal');
  }, []);

  const openClientCreateModal = useCallback(() => {
    openClientModal();
  }, [openClientModal]);

  const handleNormalizeClientName = useCallback(
    async (client: Client, normalizedName: string) => {
      const confirmed = await confirm({
        title: 'Нормализовать ФИО?',
        message: `Заменить "${client.name}" на "${normalizedName}"?`,
        confirmText: 'Нормализовать',
        cancelText: 'Отмена',
        tone: 'primary',
      });
      if (!confirmed) {
        return;
      }
      try {
        const updated = await normalizeClientName(client.id);
        updateAppData((prev) => ({
          clients: prev.clients.map((item) => (item.id === updated.id ? updated : item)),
          deals: prev.deals.map((deal) =>
            deal.clientId === updated.id ? { ...deal, clientName: updated.name } : deal,
          ),
          policies: prev.policies.map((policy) => ({
            ...policy,
            clientName: policy.clientId === updated.id ? updated.name : policy.clientName,
            insuredClientName:
              policy.insuredClientId === updated.id ? updated.name : policy.insuredClientName,
          })),
        }));
        updatePoliciesList((prev) =>
          prev.map((policy) => ({
            ...policy,
            clientName: policy.clientId === updated.id ? updated.name : policy.clientName,
            insuredClientName:
              policy.insuredClientId === updated.id ? updated.name : policy.insuredClientName,
          })),
        );
        addNotification('ФИО клиента нормализовано', 'success', 3000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось нормализовать ФИО клиента');
        throw err;
      }
    },
    [addNotification, confirm, setError, updateAppData, updatePoliciesList],
  );

  const adjustPaymentsTotals = useCallback(
    <T extends { id: string; paymentsTotal?: string | null; paymentsPaid?: string | null }>(
      items: T[],
      targetId: string | undefined | null,
      totalDelta: number,
      paidDelta: number,
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
    [],
  );

  const notifyDealEventsChanged = useCallback((dealIds: (string | null | undefined)[]) => {
    const uniqueDealIds = Array.from(
      new Set(dealIds.filter((dealId): dealId is string => Boolean(dealId))),
    );
    if (uniqueDealIds.length === 0) {
      return;
    }

    setDealEventsRefreshTokens((prev) => {
      const next = { ...prev };
      uniqueDealIds.forEach((dealId) => {
        next[dealId] = (next[dealId] ?? 0) + 1;
      });
      return next;
    });
  }, []);

  const {
    handleAddPayment,
    handleUpdatePayment,
    handleDeletePayment,
    handleMarkPaymentPaid,
    handleAddFinancialRecord,
    handleMarkFinancialRecordPaid,
    handleUpdateFinancialRecord,
    handleDeleteFinancialRecord,
    handleCreateFinanceStatement,
    handleUpdateFinanceStatement,
    handleAttachFinanceStatementRecords,
    handleDeleteFinanceStatement,
    handleRemoveFinanceStatementRecords,
    handleApplyFinanceStatementAmount,
  } = useFinanceActions({
    payments,
    financialRecordModal,
    updateAppData,
    setError,
    confirm,
    addNotification,
    invalidateDealsCache,
    syncDealsByIds,
    adjustPaymentsTotals,
    setPaymentModal,
    setFinancialRecordModal,
  });

  const {
    policyDealId,
    policyPrefill,
    policyDefaultCounterparty,
    editingPolicy,
    setEditingPolicy,
    closePolicyModal,
    handlePolicyDraftReady,
    handleRequestAddPolicy,
    handleRequestEditPolicy,
    handleAddPolicy,
    handleUpdatePolicy,
    handleUpdatePolicyRenewed,
    handleDeletePolicy,
    handleMovePolicy,
    policyDealExecutorName,
    editingPolicyExecutorName,
  } = usePolicyActions({
    clients,
    dealsById,
    policies,
    payments,
    statements,
    salesChannels,
    dealFilters,
    setModal,
    setError,
    setIsSyncing,
    updateAppData,
    invalidateDealsCache,
    invalidateDealPoliciesCache,
    loadDealPolicies,
    mergeDealWithHydratedQuotes,
    refreshDealsWithSelection,
    syncDealsByIds,
    selectDealById: dealPreview.selectDealById,
    notifyDealEventsChanged,
    adjustPaymentsTotals,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    void runAsyncUiAction({
      action: () => refreshDealsWithSelection(dealFilters),
      debugLabel: 'Deal search failed',
      fallbackMessage: 'Ошибка при поиске сделок',
      setError,
    });
  }, [dealFilters, isAuthenticated, refreshDealsWithSelection, setError]);

  const {
    handleAddDeal,
    handleCloseDeal,
    handleReopenDeal,
    handleUpdateDeal,
    handlePinDeal,
    handleUnpinDeal,
    handlePostponeDeal,
    handleDeleteDeal,
    handleRestoreDeal,
    handleMergeDeals,
    handleAddQuote,
    handleUpdateQuote,
    handleRequestEditQuote,
    handleDeleteQuote,
    handleDriveFolderCreated,
    handleFetchChatMessages,
    handleCreateDealMailbox,
    handleCheckDealMailbox,
    handleSendChatMessage,
    handleDeleteChatMessage,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    cycleSelectedDeal,
    openSelectedDealPreview,
    deleteSelectedDeal,
    restoreSelectedDeal,
  } = useDealActions({
    deals,
    dealsById,
    selectedDeal,
    selectedDealId: dealPreview.selectedDealId,
    isDealFocusCleared: dealPreview.isDealFocusCleared,
    isDealsRoute,
    dealFilters,
    editingQuote,
    setEditingQuote,
    setQuoteDealId,
    setModal,
    confirm,
    addNotification,
    setError,
    setIsSyncing,
    updateAppData,
    invalidateDealsCache,
    refreshDeals,
    refreshDealsWithSelection,
    selectDealById: dealPreview.selectDealById,
    clearSelectedDealFocus: dealPreview.clearSelectedDealFocus,
    resetDealSelection: dealPreview.resetDealSelection,
    requestDealRowFocus: dealPreview.requestDealRowFocus,
    registerProtectedCreatedDeal,
    invalidateDealQuotesCache,
    invalidateDealTasksCache,
    cacheDealQuotes,
    openDealPreview: handleOpenDealPreview,
  });

  const {
    paletteMode,
    openCommandsPalette,
    closePalette,
    commandItems,
    taskDealItems,
    taskDealLoading,
    setTaskDealQuery,
  } = useAppInteractionShell({
    clients,
    clientsById,
    deals,
    isClientsRoute,
    isDealsRoute,
    isPoliciesRoute,
    isTasksRoute,
    navigate: (path) => navigate(path),
    policiesList,
    setQuickTaskDealId,
    tasks,
    handleClientDeleteRequest,
    handleClientEditRequest,
    handleRequestEditPolicy,
    handleUpdateTask,
    cycleSelectedDeal,
    dealPreview,
    deleteSelectedDeal,
    openClientCreateModal,
    openDealCreateModal,
    openSelectedDealPreview,
    restoreSelectedDeal,
  });

  const handleLogout = useCallback(() => {
    clearTokens();
    setCurrentUser(null);
    setIsAuthenticated(false);
    resetPoliciesState();
    resetPoliciesListState();
    setAppData({
      clients: [],
      deals: [],
      policies: [],
      salesChannels: [],
      payments: [],
      financialRecords: [],
      statements: [],
      tasks: [],
      users: [],
    });
  }, [resetPoliciesListState, resetPoliciesState, setAppData, setCurrentUser, setIsAuthenticated]);

  const routeData = useMemo<AppRouteDataBundle>(
    () => ({
      deals,
      clients,
      clientDuplicateHints,
      policies,
      policiesList,
      payments,
      financialRecords,
      statements,
      salesChannels,
      tasks,
      users,
      currentUser,
    }),
    [
      deals,
      clients,
      clientDuplicateHints,
      policies,
      policiesList,
      payments,
      financialRecords,
      statements,
      salesChannels,
      tasks,
      users,
      currentUser,
    ],
  );

  const routeDealsActions = useMemo<AppRouteDealsActions>(
    () => ({
      onClientEdit: handleClientEditRequest,
      onClientOpenById: handleClientOpenById,
      onClientDelete: handleClientDeleteRequest,
      onClientMerge: handleClientMergeRequest,
      onClientFindSimilar: handleClientFindSimilarRequest,
      onClientNormalizeName: handleNormalizeClientName,
      selectedDealId: effectiveSelectedDealId,
      isDealFocusCleared: dealPreview.isDealFocusCleared,
      dealRowFocusRequest: dealPreview.dealRowFocusRequest,
      dealAccessMessage,
      onClearDealAccessMessage: clearDealAccessMessage,
      onSelectDeal: handleSelectDeal,
      onClearDealFocus: dealPreview.clearSelectedDealFocus,
      onDealPreview: handleOpenDealPreview,
      onCloseDeal: handleCloseDeal,
      onReopenDeal: handleReopenDeal,
      onUpdateDeal: handleUpdateDeal,
      onRefreshDeal: handleRefreshSelectedDeal,
      onRefreshDealsList: handleRefreshDealsList,
      onPinDeal: handlePinDeal,
      onUnpinDeal: handleUnpinDeal,
      onPostponeDeal: handlePostponeDeal,
      onRequestAddQuote: (dealId) => setQuoteDealId(dealId),
      onRequestEditQuote: handleRequestEditQuote,
      onRequestAddPolicy: handleRequestAddPolicy,
      onRequestEditPolicy: handleRequestEditPolicy,
      onRequestAddClient: () => openClientModal('deal'),
      pendingDealClientId,
      onPendingDealClientConsumed: handlePendingDealClientConsumed,
      onDeleteQuote: handleDeleteQuote,
      onDeletePolicy: handleDeletePolicy,
      onMovePolicy: handleMovePolicy,
      onUpdatePolicyRenewed: handleUpdatePolicyRenewed,
      onDriveFolderCreated: handleDriveFolderCreated,
      onCreateDealMailbox: handleCreateDealMailbox,
      onCheckDealMailbox: handleCheckDealMailbox,
      onFetchChatMessages: handleFetchChatMessages,
      onSendChatMessage: handleSendChatMessage,
      onDeleteChatMessage: handleDeleteChatMessage,
      onFetchDealHistory: fetchDealHistory,
      onFetchDealEvents: fetchDealEvents,
      dealEventsRefreshTokens,
      onCreateDealEvent: createDealEvent,
      onUpdateDealEvent: updateDealEvent,
      onDeleteDealEvent: deleteDealEvent,
      onCreateTask: handleCreateTask,
      onUpdateTask: handleUpdateTask,
      onRefreshPolicies: handleRefreshSelectedDealPolicies,
      onDeleteTask: handleDeleteTask,
      onRefreshPoliciesList: refreshPoliciesList,
      onDeleteDeal: handleDeleteDeal,
      onRestoreDeal: handleRestoreDeal,
      onMergeDeals: handleMergeDeals,
      onPolicyDraftReady: handlePolicyDraftReady,
      onDealSelectionBlockedChange: setDealSelectionBlocked,
    }),
    [
      dealPreview.clearSelectedDealFocus,
      dealPreview.dealRowFocusRequest,
      dealAccessMessage,
      dealPreview.isDealFocusCleared,
      effectiveSelectedDealId,
      clearDealAccessMessage,
      handleCheckDealMailbox,
      handleClientDeleteRequest,
      handleClientEditRequest,
      handleClientOpenById,
      handleClientFindSimilarRequest,
      handleClientMergeRequest,
      handleNormalizeClientName,
      handleCloseDeal,
      handleCreateDealMailbox,
      handleCreateTask,
      handleDeleteChatMessage,
      handleDeleteDeal,
      handleDeletePolicy,
      handleMovePolicy,
      handleUpdatePolicyRenewed,
      handleDeleteQuote,
      handleDeleteTask,
      handleDriveFolderCreated,
      handleFetchChatMessages,
      handleMergeDeals,
      handleOpenDealPreview,
      handlePendingDealClientConsumed,
      handlePinDeal,
      handlePolicyDraftReady,
      handlePostponeDeal,
      handleRefreshDealsList,
      handleRefreshSelectedDeal,
      handleRefreshSelectedDealPolicies,
      handleReopenDeal,
      handleRequestAddPolicy,
      handleRequestEditPolicy,
      handleRequestEditQuote,
      handleRestoreDeal,
      handleSelectDeal,
      handleSendChatMessage,
      handleUnpinDeal,
      handleUpdateDeal,
      handleUpdateTask,
      dealEventsRefreshTokens,
      openClientModal,
      pendingDealClientId,
      refreshPoliciesList,
      setDealSelectionBlocked,
    ],
  );

  const routeFinanceActions = useMemo<AppRouteFinanceActions>(
    () => ({
      onAddPayment: handleAddPayment,
      onUpdatePayment: handleUpdatePayment,
      onDeletePayment: handleDeletePayment,
      onMarkPaymentPaid: handleMarkPaymentPaid,
      onAddFinancialRecord: handleAddFinancialRecord,
      onMarkFinancialRecordPaid: handleMarkFinancialRecordPaid,
      onUpdateFinancialRecord: handleUpdateFinancialRecord,
      onDeleteFinancialRecord: handleDeleteFinancialRecord,
      onCreateFinanceStatement: handleCreateFinanceStatement,
      onDeleteFinanceStatement: handleDeleteFinanceStatement,
      onAttachFinanceStatementRecords: handleAttachFinanceStatementRecords,
      onRemoveFinanceStatementRecords: handleRemoveFinanceStatementRecords,
      onUpdateFinanceStatement: handleUpdateFinanceStatement,
      onApplyFinanceStatementAmount: handleApplyFinanceStatementAmount,
    }),
    [
      handleAddFinancialRecord,
      handleAddPayment,
      handleApplyFinanceStatementAmount,
      handleAttachFinanceStatementRecords,
      handleCreateFinanceStatement,
      handleDeleteFinanceStatement,
      handleDeleteFinancialRecord,
      handleDeletePayment,
      handleMarkPaymentPaid,
      handleMarkFinancialRecordPaid,
      handleRemoveFinanceStatementRecords,
      handleUpdateFinanceStatement,
      handleUpdateFinancialRecord,
      handleUpdatePayment,
    ],
  );

  const routeFilters = useMemo<AppRouteFilterState>(
    () => ({
      dealSearch: dealSearchInput,
      onDealSearchChange: setDealSearchInput,
      onDealSearchSubmit: applyDealSearch,
      dealExecutorFilter,
      onDealExecutorFilterChange: setDealExecutorFilter,
      dealShowDeleted,
      onDealShowDeletedChange: setDealShowDeleted,
      dealShowClosed,
      onDealShowClosedChange: setDealShowClosed,
      dealOrdering,
      onDealOrderingChange: setDealOrdering,
    }),
    [
      applyDealSearch,
      dealExecutorFilter,
      dealOrdering,
      dealSearchInput,
      dealShowClosed,
      dealShowDeleted,
      setDealExecutorFilter,
      setDealOrdering,
      setDealSearchInput,
      setDealShowClosed,
      setDealShowDeleted,
    ],
  );

  const routeLoading = useMemo<AppRouteLoadingState>(
    () => ({
      onRefreshTasks: ensureTasksLoaded,
      tasksPage,
      tasksTotalCount,
      onRefreshCommissionsSnapshot: async () => {
        await ensureCommissionsDataLoaded({ force: true });
      },
      onLoadMoreStatements: loadMoreStatements,
      statementsTotalCount,
      statementsHasMore,
      isLoadingMoreStatements,
      onLoadMoreDeals: loadMoreDeals,
      dealsHasMore,
      dealsTotalCount,
      isLoadingMoreDeals,
      isRefreshingDealsList,
      onLoadMorePolicies: loadMorePolicies,
      policiesHasMore,
      isLoadingMorePolicies,
      isPoliciesListLoading,
      policiesListError,
      isCommissionsDataLoading,
      hasCommissionsSnapshotLoaded,
      isFinanceDataLoading,
      hasFinanceSnapshotLoaded,
      isTasksLoading,
      isSelectedDealTasksLoading,
      isSelectedDealQuotesLoading,
    }),
    [
      dealsHasMore,
      dealsTotalCount,
      ensureCommissionsDataLoaded,
      loadMoreStatements,
      statementsHasMore,
      statementsTotalCount,
      isLoadingMoreStatements,
      ensureTasksLoaded,
      hasCommissionsSnapshotLoaded,
      hasFinanceSnapshotLoaded,
      isCommissionsDataLoading,
      isFinanceDataLoading,
      isLoadingMoreDeals,
      isLoadingMorePolicies,
      isPoliciesListLoading,
      policiesListError,
      isRefreshingDealsList,
      isSelectedDealQuotesLoading,
      isSelectedDealTasksLoading,
      isTasksLoading,
      tasksPage,
      tasksTotalCount,
      loadMoreDeals,
      loadMorePolicies,
      policiesHasMore,
    ],
  );

  const routeBindings = useAppRouteShell({
    routeData,
    routeDealsActions,
    routeFilters,
    routeFinanceActions,
    routeLoading,
  });

  const appModalsProps = {
    modal,
    setModal,
    openClientModal,
    closeClientModal,
    isClientModalOverlayOpen,
    clients,
    users,
    handleAddClient,
    handleAddDeal,
    pendingDealClientId,
    onPendingDealClientConsumed: handlePendingDealClientConsumed,
    quoteDealId,
    setQuoteDealId,
    handleAddQuote,
    editingQuote,
    setEditingQuote,
    handleUpdateQuote,
    policyDealId,
    policyDefaultCounterparty,
    closePolicyModal,
    policyPrefill,
    policyDealExecutorName,
    editingPolicyExecutorName,
    editingPolicy,
    setEditingPolicy,
    salesChannels,
    handleAddPolicy,
    handleUpdatePolicy,
    paymentModal,
    setPaymentModal,
    handleUpdatePayment,
    payments,
    financialRecordModal,
    setFinancialRecordModal,
    handleUpdateFinancialRecord,
    financialRecords,
    confirm,
  };

  const previewModalProps = {
    isOpen: Boolean(dealPreview.previewDealId),
    previewDeal,
    previewClient,
    previewSellerUser,
    previewExecutorUser,
    onClose: dealPreview.handleCloseDealPreview,
    onOpenFull: (dealId: string) => {
      dealPreview.handleCloseDealPreview();
      navigate(`/deals?dealId=${encodeURIComponent(dealId)}`);
    },
    panelProps: {
      deals,
      clients,
      onClientEdit: handleClientEditRequest,
      onClientOpenById: handleClientOpenById,
      policies,
      payments,
      financialRecords,
      tasks,
      users,
      currentUser,
      sortedDeals: deals,
      onSelectDeal: handleSelectDeal,
      onCloseDeal: handleCloseDeal,
      onReopenDeal: handleReopenDeal,
      onUpdateDeal: handleUpdateDeal,
      onPostponeDeal: handlePostponeDeal,
      onMergeDeals: handleMergeDeals,
      onRequestAddQuote: (dealId: string) => setQuoteDealId(dealId),
      onRequestEditQuote: handleRequestEditQuote,
      onRequestAddPolicy: handleRequestAddPolicy,
      onRequestEditPolicy: handleRequestEditPolicy,
      onRequestAddClient: () => openClientModal('deal'),
      pendingDealClientId,
      onPendingDealClientConsumed: handlePendingDealClientConsumed,
      onDeleteQuote: handleDeleteQuote,
      onDeletePolicy: handleDeletePolicy,
      onMovePolicy: handleMovePolicy,
      onUpdatePolicyRenewed: handleUpdatePolicyRenewed,
      onRefreshPolicies: handleRefreshPreviewDealPolicies,
      onPolicyDraftReady: handlePolicyDraftReady,
      onAddPayment: handleAddPayment,
      onUpdatePayment: handleUpdatePayment,
      onDeletePayment: handleDeletePayment,
      onMarkPaymentPaid: handleMarkPaymentPaid,
      onAddFinancialRecord: handleAddFinancialRecord,
      onMarkFinancialRecordPaid: handleMarkFinancialRecordPaid,
      onUpdateFinancialRecord: handleUpdateFinancialRecord,
      onDeleteFinancialRecord: handleDeleteFinancialRecord,
      onDriveFolderCreated: handleDriveFolderCreated,
      onCreateDealMailbox: handleCreateDealMailbox,
      onCheckDealMailbox: handleCheckDealMailbox,
      onFetchChatMessages: handleFetchChatMessages,
      onSendChatMessage: handleSendChatMessage,
      onDeleteChatMessage: handleDeleteChatMessage,
      onFetchDealHistory: fetchDealHistory,
      onFetchDealEvents: fetchDealEvents,
      dealEventsRefreshToken: previewDeal ? (dealEventsRefreshTokens[previewDeal.id] ?? 0) : 0,
      onCreateDealEvent: createDealEvent,
      onUpdateDealEvent: updateDealEvent,
      onDeleteDealEvent: deleteDealEvent,
      onCreateTask: handleCreateTask,
      onUpdateTask: handleUpdateTask,
      onDeleteTask: handleDeleteTask,
      onDeleteDeal: handleDeleteDeal,
      onRestoreDeal: handleRestoreDeal,
      onDealSelectionBlockedChange: setDealSelectionBlocked,
      isTasksLoading: isPreviewDealTasksLoading,
      isQuotesLoading: isPreviewDealQuotesLoading,
    },
  };

  return {
    authLoading,
    isAuthenticated,
    pendingPostLoginRedirect,
    handleLoginSuccess,
    shellProps: {
      onAddDeal: openDealCreateModal,
      onAddClient: openClientCreateModal,
      onOpenCommandPalette: openCommandsPalette,
      currentUser,
      onLogout: handleLogout,
      error,
      onClearError: () => setError(null),
    },
    routeBindings,
    shortcutsProps: {
      paletteMode,
      commandItems,
      taskDealItems,
      taskDealLoading,
      onTaskDealQueryChange: setTaskDealQuery,
      onClose: closePalette,
    },
    ConfirmDialogRenderer,
    overlayProps: {
      appModalsProps,
      clientDeleteTarget,
      closeMergeModal,
      closeSimilarClientsModal,
      editingClient,
      handleClientMergePreview,
      handleCreateTask,
      handleDeleteClient,
      handleExcludeClientSimilarity,
      handleMergeFromSimilar,
      handleClientMergeRetry,
      handleMergeSubmit,
      handleUpdateClient,
      isClientMergePreviewConfirmed,
      isClientMergePreviewLoading,
      isMergingClients,
      isSimilarClientsLoading,
      isSyncing,
      mergeCandidates,
      mergeError,
      mergeSearch,
      mergeSources,
      mergeTargetClient,
      onCloseClientDelete: () => setClientDeleteTarget(null),
      onCloseEditClient: () => setEditingClient(null),
      onCloseQuickTask: () => setQuickTaskDealId(null),
      previewModalProps,
      quickTaskDeal,
      quickTaskUsers: users,
      setClientMergeFieldOverrides,
      setMergeSearch,
      similarCandidates,
      similarClientTargetId,
      similarClientsError,
      similarTargetClient,
      toggleMergeSource,
      clientMergeFieldOverrides,
      clientMergePreview,
      clientMergeSession,
      clientMergeStep,
    },
  };
};
