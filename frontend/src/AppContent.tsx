import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { fetchDealHistory, clearTokens } from './api';
import { AppRoutes } from './components/app/AppRoutes';
import { AppShell } from './components/app/AppShell';
import { AppShortcutsController } from './components/app/AppShortcutsController';
import type {
  AppRouteDataBundle,
  AppRouteDealsActions,
  AppRouteFilterState,
  AppRouteFinanceActions,
  AppRouteLoadingState,
} from './components/app/appRoutes.types';
import type { ModalType } from './components/app/types';
import { useNotification } from './contexts/NotificationContext';
import { AppOverlayShell } from './features/app/overlay-shell/AppOverlayShell';
import { useAppBootstrapShell } from './features/app/bootstrap-shell/useAppBootstrapShell';
import { useAppInteractionShell } from './features/app/interaction-shell/useAppInteractionShell';
import { useDealPreviewController } from './features/app/interaction-shell/useDealPreviewController';
import { useAppRouteShell } from './features/app/route-shell/useAppRouteShell';
import { useAppData } from './hooks/useAppData';
import { useAuthBootstrap } from './hooks/useAuthBootstrap';
import { useDealFilters } from './hooks/useDealFilters';
import { useConfirm } from './hooks/useConfirm';
import { resolveEffectiveSelectedDealId } from './hooks/useSelectedDeal';
import { useClientActions } from './hooks/appContent/useClientActions';
import { useDealActions } from './hooks/appContent/useDealActions';
import { useDealDetailsData } from './hooks/appContent/useDealDetailsData';
import { useFinanceActions } from './hooks/appContent/useFinanceActions';
import { usePolicyActions } from './hooks/appContent/usePolicyActions';
import type { Client, Quote, User } from './types';
import type { FinancialRecordModalState, PaymentModalState } from './types';
import { formatAmountValue, parseAmountValue } from './utils/appContent';
import { runAsyncUiAction } from './utils/uiAction';

const { Suspense, lazy } = React;

const LoginPage = lazy(async () => {
  const module = await import('./components/LoginPage');
  return { default: module.LoginPage };
});

const AppContent: React.FC = () => {
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

  const {
    dataState,
    loadData,
    ensureCommissionsDataLoaded,
    ensureFinanceDataLoaded,
    ensureTasksLoaded,
    refreshDeals,
    invalidateDealsCache,
    refreshPolicies,
    refreshPoliciesList,
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
    isLoading,
    isCommissionsDataLoading,
    hasCommissionsSnapshotLoaded,
    isFinanceDataLoading,
    hasFinanceSnapshotLoaded,
    isTasksLoading,
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
    handleMergeFromSimilar,
  } = useClientActions({
    clients,
    setModal,
    setIsSyncing,
    setError,
    updateAppData,
    addNotification,
  });

  const navigate = useNavigate();
  const location = useLocation();
  const dealPreview = useDealPreviewController();

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

  const openDealCreateModal = useCallback(() => {
    setModal('deal');
  }, []);

  const openClientCreateModal = useCallback(() => {
    openClientModal();
  }, [openClientModal]);

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
    handleDeleteFinanceStatement,
    handleRemoveFinanceStatementRecords,
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
    handleDeletePolicy,
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

  const { paletteMode, openCommandsPalette, closePalette, commandItems, taskDealItems } =
    useAppInteractionShell({
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
      policies,
      policiesList,
      payments,
      financialRecords,
      statements,
      tasks,
      users,
      currentUser,
    }),
    [
      deals,
      clients,
      policies,
      policiesList,
      payments,
      financialRecords,
      statements,
      tasks,
      users,
      currentUser,
    ],
  );

  const routeDealsActions = useMemo<AppRouteDealsActions>(
    () => ({
      onClientEdit: handleClientEditRequest,
      onClientDelete: handleClientDeleteRequest,
      onClientMerge: handleClientMergeRequest,
      onClientFindSimilar: handleClientFindSimilarRequest,
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
      onDriveFolderCreated: handleDriveFolderCreated,
      onCreateDealMailbox: handleCreateDealMailbox,
      onCheckDealMailbox: handleCheckDealMailbox,
      onFetchChatMessages: handleFetchChatMessages,
      onSendChatMessage: handleSendChatMessage,
      onDeleteChatMessage: handleDeleteChatMessage,
      onFetchDealHistory: fetchDealHistory,
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
      handleClientFindSimilarRequest,
      handleClientMergeRequest,
      handleCloseDeal,
      handleCreateDealMailbox,
      handleCreateTask,
      handleDeleteChatMessage,
      handleDeleteDeal,
      handleDeletePolicy,
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
      onRemoveFinanceStatementRecords: handleRemoveFinanceStatementRecords,
      onUpdateFinanceStatement: handleUpdateFinanceStatement,
    }),
    [
      handleAddFinancialRecord,
      handleAddPayment,
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
      onRefreshCommissionsSnapshot: async () => {
        await ensureCommissionsDataLoaded({ force: true });
      },
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
    panelProps: {
      deals,
      clients,
      onClientEdit: handleClientEditRequest,
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

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">{authLoading ? 'Загрузка...' : 'Загрузка данных...'}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen flex items-center justify-center bg-slate-100">
            <div className="text-slate-500">Загрузка...</div>
          </div>
        }
      >
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      </Suspense>
    );
  }

  if (pendingPostLoginRedirect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">Переход...</div>
      </div>
    );
  }

  return (
    <AppShell
      onAddDeal={openDealCreateModal}
      onAddClient={openClientCreateModal}
      onOpenCommandPalette={openCommandsPalette}
      currentUser={currentUser}
      onLogout={handleLogout}
      error={error}
      onClearError={() => setError(null)}
    >
      <AppRoutes
        data={routeBindings.routeData}
        dealsActions={routeBindings.routeDealsActions}
        financeActions={routeBindings.routeFinanceActions}
        filters={routeBindings.routeFilters}
        loading={routeBindings.routeLoading}
      />
      <AppShortcutsController
        paletteMode={paletteMode}
        commandItems={commandItems}
        taskDealItems={taskDealItems}
        onClose={closePalette}
      />
      <AppOverlayShell
        appModalsProps={appModalsProps}
        clientDeleteTarget={clientDeleteTarget}
        closeMergeModal={closeMergeModal}
        closeSimilarClientsModal={closeSimilarClientsModal}
        confirmDialogRenderer={<ConfirmDialogRenderer />}
        editingClient={editingClient}
        handleClientMergePreview={handleClientMergePreview}
        handleCreateTask={handleCreateTask}
        handleDeleteClient={handleDeleteClient}
        handleMergeFromSimilar={handleMergeFromSimilar}
        handleMergeSubmit={handleMergeSubmit}
        handleUpdateClient={handleUpdateClient}
        isClientMergePreviewConfirmed={isClientMergePreviewConfirmed}
        isClientMergePreviewLoading={isClientMergePreviewLoading}
        isMergingClients={isMergingClients}
        isSimilarClientsLoading={isSimilarClientsLoading}
        isSyncing={isSyncing}
        mergeCandidates={mergeCandidates}
        mergeError={mergeError}
        mergeSearch={mergeSearch}
        mergeSources={mergeSources}
        mergeTargetClient={mergeTargetClient}
        onCloseClientDelete={() => setClientDeleteTarget(null)}
        onCloseEditClient={() => setEditingClient(null)}
        onCloseQuickTask={() => setQuickTaskDealId(null)}
        previewModalProps={previewModalProps}
        quickTaskDeal={quickTaskDeal}
        quickTaskUsers={users}
        setClientMergeFieldOverrides={setClientMergeFieldOverrides}
        setMergeSearch={setMergeSearch}
        similarCandidates={similarCandidates}
        similarClientTargetId={similarClientTargetId}
        similarClientsError={similarClientsError}
        similarTargetClient={similarTargetClient}
        toggleMergeSource={toggleMergeSource}
        clientMergeFieldOverrides={clientMergeFieldOverrides}
        clientMergePreview={clientMergePreview}
        clientMergeStep={clientMergeStep}
      />
    </AppShell>
  );
};

export default AppContent;
