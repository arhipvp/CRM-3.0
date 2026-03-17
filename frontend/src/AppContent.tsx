import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useNotification } from './contexts/NotificationContext';
import { AppRoutes } from './components/app/AppRoutes';
import type {
  AppRouteDataBundle,
  AppRouteDealsActions,
  AppRouteFilterState,
  AppRouteFinanceActions,
  AppRouteLoadingState,
} from './components/app/appRoutes.types';
import { AppShell } from './components/app/AppShell';
import { AppShortcutsController } from './components/app/AppShortcutsController';
import { ClientForm } from './components/forms/ClientForm';
import { AddTaskForm } from './components/forms/AddTaskForm';
import { BTN_DANGER, BTN_SECONDARY } from './components/common/buttonStyles';
import { FormActions } from './components/common/forms/FormActions';
import { FormModal } from './components/common/modal/FormModal';
import { Modal } from './components/Modal';
import { formatErrorMessage } from './utils/formatErrorMessage';
import { fetchDealHistory, clearTokens } from './api';
import { Client, Quote, User } from './types';
import { useAppData } from './hooks/useAppData';
import { useAuthBootstrap } from './hooks/useAuthBootstrap';
import { useDealFilters } from './hooks/useDealFilters';
import { useConfirm } from './hooks/useConfirm';
import type { ModalType } from './components/app/types';
import type { FinancialRecordModalState, PaymentModalState } from './types';
import { formatAmountValue, parseAmountValue } from './utils/appContent';
import { formatShortcut } from './hotkeys/formatShortcut';
import { useClientActions } from './hooks/appContent/useClientActions';
import { useCommandPalette } from './hooks/appContent/useCommandPalette';
import { useDealActions } from './hooks/appContent/useDealActions';
import { useAppBootstrapNavigation } from './hooks/appContent/useAppBootstrapNavigation';
import { useAppRouteBindings } from './hooks/appContent/useAppRouteBindings';
import { useDealDetailsData } from './hooks/appContent/useDealDetailsData';
import { useFinanceActions } from './hooks/appContent/useFinanceActions';
import { usePolicyActions } from './hooks/appContent/usePolicyActions';
import { useDealPreviewController } from './hooks/appContent/useDealPreviewController';
import { resolveEffectiveSelectedDealId } from './hooks/useSelectedDeal';
import type { CommandPaletteItem } from './components/common/modal/CommandPalette';

const { Suspense, lazy } = React;

const LoginPage = lazy(async () => {
  const module = await import('./components/LoginPage');
  return { default: module.LoginPage };
});

const AppModals = lazy(async () => {
  const module = await import('./components/app/AppModals');
  return { default: module.AppModals };
});

const AppDealPreviewModal = lazy(async () => {
  const module = await import('./components/app/AppDealPreviewModal');
  return { default: module.AppDealPreviewModal };
});

const ClientMergeModal = lazy(async () => {
  const module = await import('./components/app/ClientMergeModal');
  return { default: module.ClientMergeModal };
});

const SimilarClientsModal = lazy(async () => {
  const module = await import('./components/views/SimilarClientsModal');
  return { default: module.SimilarClientsModal };
});

const HOTKEY_HELP_ITEMS: CommandPaletteItem[] = [
  {
    id: 'help-open-palette',
    title: 'Открыть командную палитру',
    shortcut: formatShortcut('mod+k'),
    disabled: true,
  },
  {
    id: 'help-open-hotkeys',
    title: 'Открыть справку по горячим клавишам',
    shortcut: formatShortcut('mod+/'),
    disabled: true,
  },
  {
    id: 'help-create-deal',
    title: 'Создать сделку',
    shortcut: formatShortcut('mod+shift+d'),
    disabled: true,
  },
  {
    id: 'help-create-client',
    title: 'Создать клиента',
    shortcut: formatShortcut('mod+shift+c'),
    disabled: true,
  },
  {
    id: 'help-create-task',
    title: 'Создать задачу',
    shortcut: formatShortcut('mod+shift+t'),
    disabled: true,
  },
  {
    id: 'help-close-layer',
    title: 'Закрыть активное окно',
    shortcut: formatShortcut('escape'),
    disabled: true,
  },
  {
    id: 'help-context-switch',
    title: 'Текущий раздел: переключить выбранную сущность',
    shortcut: `${formatShortcut('alt+arrowup')} / ${formatShortcut('alt+arrowdown')}`,
    disabled: true,
  },
  {
    id: 'help-context-open',
    title: 'Текущий раздел: открыть выбранную сущность',
    shortcut: formatShortcut('mod+o'),
    disabled: true,
  },
  {
    id: 'help-context-delete',
    title: 'Текущий раздел: удалить выбранную сущность (где доступно)',
    shortcut: formatShortcut('mod+backspace'),
    disabled: true,
  },
  {
    id: 'help-deals-restore',
    title: 'Сделки: восстановить выбранную',
    shortcut: formatShortcut('mod+shift+r'),
    disabled: true,
  },
  {
    id: 'help-tasks-done',
    title: 'Задачи: отметить выбранную выполненной',
    shortcut: formatShortcut('mod+enter'),
    disabled: true,
  },
];

const AppContent: React.FC = () => {
  const { addNotification } = useNotification();
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [modal, setModal] = useState<ModalType>(null);
  const [quoteDealId, setQuoteDealId] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState | null>(null);
  const [financialRecordModal, setFinancialRecordModal] =
    useState<FinancialRecordModalState | null>(null);
  const {
    dataState,
    loadData,
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
  const {
    selectedDealId,
    isDealFocusCleared,
    dealRowFocusRequest,
    previewDealId,
    clearSelectedDealFocus,
    resetDealSelection,
    selectDealById,
    handleOpenDealPreview: openDealPreviewById,
    handleCloseDealPreview,
    requestDealRowFocus,
  } = useDealPreviewController();
  const [isDealSelectionBlocked, setDealSelectionBlocked] = useState(false);
  const [quickTaskDealId, setQuickTaskDealId] = useState<string | null>(null);
  const [isRefreshingDealsList, setIsRefreshingDealsList] = useState(false);
  const location = useLocation();
  const isDealsRoute = location.pathname.startsWith('/deals');
  const isCommissionsRoute = location.pathname.startsWith('/commissions');
  const isLoginRoute = location.pathname === '/login';
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
  const { deepLinkedDealId, pendingPostLoginRedirect } = useAppBootstrapNavigation({
    ensureFinanceDataLoaded,
    ensureTasksLoaded,
    isAuthenticated,
    isCommissionsRoute,
    isDealsRoute,
    isLoginRoute,
    isTasksRoute: location.pathname.startsWith('/tasks'),
    locationSearch: location.search,
    navigate,
    refreshPolicies,
    selectDealById,
    setError,
  });

  const effectiveSelectedDealId = useMemo(
    () =>
      resolveEffectiveSelectedDealId({
        deals,
        selectedDealId,
        isDealFocusCleared,
      }),
    [deals, isDealFocusCleared, selectedDealId],
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
    previewDealId,
    isDealSelectionBlocked,
    dealFilters,
    refreshDeals,
    invalidateDealsCache,
    updateAppData,
    setError,
    clearSelectedDealFocus,
    selectDealById,
    openDealPreviewById,
    setIsRefreshingDealsList,
  });
  const previewDeal = previewDealId ? (dealsById.get(previewDealId) ?? null) : null;
  const previewClient = previewDeal ? (clientsById.get(previewDeal.clientId) ?? null) : null;
  const previewSellerUser = previewDeal ? usersById.get(previewDeal.seller ?? '') : undefined;
  const previewExecutorUser = previewDeal ? usersById.get(previewDeal.executor ?? '') : undefined;
  const quickTaskDeal = quickTaskDealId ? (dealsById.get(quickTaskDealId) ?? null) : null;
  const selectedDeal = effectiveSelectedDealId
    ? (dealsById.get(effectiveSelectedDealId) ?? null)
    : null;
  const isClientsRoute = location.pathname.startsWith('/clients');
  const isPoliciesRoute = location.pathname.startsWith('/policies');
  const isTasksRoute = location.pathname.startsWith('/tasks');

  const [selectedClientShortcutId, setSelectedClientShortcutId] = useState<string | null>(null);
  const [selectedPolicyShortcutId, setSelectedPolicyShortcutId] = useState<string | null>(null);
  const [selectedTaskShortcutId, setSelectedTaskShortcutId] = useState<string | null>(null);

  const sortedClientsForShortcuts = useMemo(
    () =>
      [...clients].sort((left, right) => {
        const dateDiff =
          Date.parse(right.updatedAt ?? right.createdAt ?? '') -
          Date.parse(left.updatedAt ?? left.createdAt ?? '');
        if (Number.isFinite(dateDiff) && dateDiff !== 0) {
          return dateDiff;
        }
        return (left.name ?? '').localeCompare(right.name ?? '');
      }),
    [clients],
  );
  const selectedClientShortcut = selectedClientShortcutId
    ? (clientsById.get(selectedClientShortcutId) ?? null)
    : null;

  const sortedPoliciesForShortcuts = useMemo(
    () =>
      [...policiesList].sort((left, right) => {
        const dateDiff =
          Date.parse(right.updatedAt ?? right.createdAt ?? '') -
          Date.parse(left.updatedAt ?? left.createdAt ?? '');
        if (Number.isFinite(dateDiff) && dateDiff !== 0) {
          return dateDiff;
        }
        return (left.number ?? '').localeCompare(right.number ?? '');
      }),
    [policiesList],
  );
  const selectedPolicyShortcut = selectedPolicyShortcutId
    ? (sortedPoliciesForShortcuts.find((policy) => policy.id === selectedPolicyShortcutId) ?? null)
    : null;

  const sortedTasksForShortcuts = useMemo(
    () =>
      [...tasks].sort((left, right) => {
        const leftDue = left.dueAt ? Date.parse(left.dueAt) : Number.MAX_SAFE_INTEGER;
        const rightDue = right.dueAt ? Date.parse(right.dueAt) : Number.MAX_SAFE_INTEGER;
        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }
        return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
      }),
    [tasks],
  );
  const selectedTaskShortcut = selectedTaskShortcutId
    ? (sortedTasksForShortcuts.find((task) => task.id === selectedTaskShortcutId) ?? null)
    : null;

  const activeShortcutContext = useMemo(() => {
    if (isDealsRoute && selectedDeal) {
      return {
        title: 'Сделки',
        label: selectedDeal.title,
      };
    }
    if (isClientsRoute && selectedClientShortcut) {
      return {
        title: 'Клиенты',
        label: selectedClientShortcut.name,
      };
    }
    if (isPoliciesRoute && selectedPolicyShortcut) {
      return {
        title: 'Полисы',
        label: selectedPolicyShortcut.number,
      };
    }
    if (isTasksRoute && selectedTaskShortcut) {
      return {
        title: 'Задачи',
        label: selectedTaskShortcut.title,
      };
    }
    return null;
  }, [
    isClientsRoute,
    isDealsRoute,
    isPoliciesRoute,
    isTasksRoute,
    selectedClientShortcut,
    selectedDeal,
    selectedPolicyShortcut,
    selectedTaskShortcut,
  ]);

  useEffect(() => {
    if (!isClientsRoute) {
      return;
    }
    if (!sortedClientsForShortcuts.length) {
      setSelectedClientShortcutId(null);
      return;
    }
    setSelectedClientShortcutId((prev) =>
      prev && sortedClientsForShortcuts.some((client) => client.id === prev)
        ? prev
        : sortedClientsForShortcuts[0].id,
    );
  }, [isClientsRoute, sortedClientsForShortcuts]);

  useEffect(() => {
    if (!isPoliciesRoute) {
      return;
    }
    if (!sortedPoliciesForShortcuts.length) {
      setSelectedPolicyShortcutId(null);
      return;
    }
    setSelectedPolicyShortcutId((prev) =>
      prev && sortedPoliciesForShortcuts.some((policy) => policy.id === prev)
        ? prev
        : sortedPoliciesForShortcuts[0].id,
    );
  }, [isPoliciesRoute, sortedPoliciesForShortcuts]);

  useEffect(() => {
    if (!isTasksRoute) {
      return;
    }
    if (!sortedTasksForShortcuts.length) {
      setSelectedTaskShortcutId(null);
      return;
    }
    setSelectedTaskShortcutId((prev) =>
      prev && sortedTasksForShortcuts.some((task) => task.id === prev)
        ? prev
        : sortedTasksForShortcuts[0].id,
    );
  }, [isTasksRoute, sortedTasksForShortcuts]);

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
    handleAddFinancialRecord,
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
    selectDealById,
    adjustPaymentsTotals,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    setError(null);
    refreshDealsWithSelection(dealFilters).catch((err) => {
      console.error('Search deals error:', err);
      setError(formatErrorMessage(err, 'Ошибка при поиске сделок'));
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
    selectedDealId,
    isDealFocusCleared,
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
    selectDealById,
    clearSelectedDealFocus,
    resetDealSelection,
    requestDealRowFocus,
    registerProtectedCreatedDeal,
    invalidateDealQuotesCache,
    invalidateDealTasksCache,
    cacheDealQuotes,
    openDealPreview: handleOpenDealPreview,
  });

  const cycleSelectedClient = useCallback(
    (direction: 1 | -1) => {
      if (!isClientsRoute || !sortedClientsForShortcuts.length) {
        return;
      }
      if (!selectedClientShortcutId) {
        setSelectedClientShortcutId(sortedClientsForShortcuts[0].id);
        return;
      }
      const currentIndex = sortedClientsForShortcuts.findIndex(
        (client) => client.id === selectedClientShortcutId,
      );
      if (currentIndex < 0) {
        setSelectedClientShortcutId(sortedClientsForShortcuts[0].id);
        return;
      }
      const nextIndex =
        (currentIndex + direction + sortedClientsForShortcuts.length) %
        sortedClientsForShortcuts.length;
      setSelectedClientShortcutId(sortedClientsForShortcuts[nextIndex].id);
    },
    [isClientsRoute, selectedClientShortcutId, sortedClientsForShortcuts],
  );

  const cycleSelectedPolicy = useCallback(
    (direction: 1 | -1) => {
      if (!isPoliciesRoute || !sortedPoliciesForShortcuts.length) {
        return;
      }
      if (!selectedPolicyShortcutId) {
        setSelectedPolicyShortcutId(sortedPoliciesForShortcuts[0].id);
        return;
      }
      const currentIndex = sortedPoliciesForShortcuts.findIndex(
        (policy) => policy.id === selectedPolicyShortcutId,
      );
      if (currentIndex < 0) {
        setSelectedPolicyShortcutId(sortedPoliciesForShortcuts[0].id);
        return;
      }
      const nextIndex =
        (currentIndex + direction + sortedPoliciesForShortcuts.length) %
        sortedPoliciesForShortcuts.length;
      setSelectedPolicyShortcutId(sortedPoliciesForShortcuts[nextIndex].id);
    },
    [isPoliciesRoute, selectedPolicyShortcutId, sortedPoliciesForShortcuts],
  );

  const cycleSelectedTask = useCallback(
    (direction: 1 | -1) => {
      if (!isTasksRoute || !sortedTasksForShortcuts.length) {
        return;
      }
      if (!selectedTaskShortcutId) {
        setSelectedTaskShortcutId(sortedTasksForShortcuts[0].id);
        return;
      }
      const currentIndex = sortedTasksForShortcuts.findIndex(
        (task) => task.id === selectedTaskShortcutId,
      );
      if (currentIndex < 0) {
        setSelectedTaskShortcutId(sortedTasksForShortcuts[0].id);
        return;
      }
      const nextIndex =
        (currentIndex + direction + sortedTasksForShortcuts.length) %
        sortedTasksForShortcuts.length;
      setSelectedTaskShortcutId(sortedTasksForShortcuts[nextIndex].id);
    },
    [isTasksRoute, selectedTaskShortcutId, sortedTasksForShortcuts],
  );

  const openSelectedClient = useCallback(() => {
    if (!isClientsRoute || !selectedClientShortcut) {
      return;
    }
    handleClientEditRequest(selectedClientShortcut);
  }, [handleClientEditRequest, isClientsRoute, selectedClientShortcut]);

  const deleteSelectedClient = useCallback(() => {
    if (!isClientsRoute || !selectedClientShortcut) {
      return;
    }
    handleClientDeleteRequest(selectedClientShortcut);
  }, [handleClientDeleteRequest, isClientsRoute, selectedClientShortcut]);

  const openSelectedPolicy = useCallback(() => {
    if (!isPoliciesRoute || !selectedPolicyShortcut) {
      return;
    }
    handleRequestEditPolicy(selectedPolicyShortcut);
  }, [handleRequestEditPolicy, isPoliciesRoute, selectedPolicyShortcut]);

  const openSelectedTaskDealPreview = useCallback(() => {
    if (!isTasksRoute || !selectedTaskShortcut?.dealId) {
      return;
    }
    handleOpenDealPreview(selectedTaskShortcut.dealId);
  }, [handleOpenDealPreview, isTasksRoute, selectedTaskShortcut?.dealId]);

  const markSelectedTaskDone = useCallback(async () => {
    if (!isTasksRoute || !selectedTaskShortcut || selectedTaskShortcut.status === 'done') {
      return;
    }
    await handleUpdateTask(selectedTaskShortcut.id, { status: 'done' });
  }, [handleUpdateTask, isTasksRoute, selectedTaskShortcut]);

  const cycleActiveContextSelection = useCallback(
    (direction: 1 | -1) => {
      if (isDealsRoute) {
        cycleSelectedDeal(direction);
        return;
      }
      if (isClientsRoute) {
        cycleSelectedClient(direction);
        return;
      }
      if (isPoliciesRoute) {
        cycleSelectedPolicy(direction);
        return;
      }
      if (isTasksRoute) {
        cycleSelectedTask(direction);
      }
    },
    [
      cycleSelectedClient,
      cycleSelectedDeal,
      cycleSelectedPolicy,
      cycleSelectedTask,
      isClientsRoute,
      isDealsRoute,
      isPoliciesRoute,
      isTasksRoute,
    ],
  );

  const openPrimaryContextAction = useCallback(() => {
    if (isDealsRoute) {
      openSelectedDealPreview();
      return;
    }
    if (isClientsRoute) {
      openSelectedClient();
      return;
    }
    if (isPoliciesRoute) {
      openSelectedPolicy();
      return;
    }
    if (isTasksRoute) {
      openSelectedTaskDealPreview();
    }
  }, [
    isDealsRoute,
    isClientsRoute,
    isPoliciesRoute,
    isTasksRoute,
    openSelectedDealPreview,
    openSelectedClient,
    openSelectedPolicy,
    openSelectedTaskDealPreview,
  ]);

  const deletePrimaryContextAction = useCallback(async () => {
    if (isDealsRoute) {
      await deleteSelectedDeal();
      return;
    }
    if (isClientsRoute) {
      deleteSelectedClient();
    }
  }, [deleteSelectedClient, deleteSelectedDeal, isClientsRoute, isDealsRoute]);

  const { paletteMode, openCommandsPalette, closePalette, commandItems, taskDealItems } =
    useCommandPalette({
      isAuthenticated,
      deals,
      selectedDeal,
      selectedClientShortcut,
      selectedPolicyShortcut,
      selectedTaskShortcut,
      isDealsRoute,
      isClientsRoute,
      isPoliciesRoute,
      isTasksRoute,
      sortedClientsCount: sortedClientsForShortcuts.length,
      sortedPoliciesCount: sortedPoliciesForShortcuts.length,
      sortedTasksCount: sortedTasksForShortcuts.length,
      selectedDealId,
      selectedDealExists: Boolean(selectedDealId && dealsById.has(selectedDealId)),
      navigate: (path) => navigate(path),
      addNotification,
      selectDealById,
      setQuickTaskDealId,
      openDealCreateModal,
      openClientCreateModal,
      openSelectedDealPreview,
      deleteSelectedDeal,
      restoreSelectedDeal,
      openSelectedClient,
      deleteSelectedClient,
      openSelectedPolicy,
      openSelectedTaskDealPreview,
      markSelectedTaskDone,
      cycleActiveContextSelection,
      openPrimaryContextAction,
      deletePrimaryContextAction,
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
      isDealFocusCleared,
      dealRowFocusRequest,
      onSelectDeal: handleSelectDeal,
      onClearDealFocus: clearSelectedDealFocus,
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
      clearSelectedDealFocus,
      dealRowFocusRequest,
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
      handleRefreshSelectedDeal,
      handleRefreshDealsList,
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
      isDealFocusCleared,
      openClientModal,
      pendingDealClientId,
      refreshPoliciesList,
      effectiveSelectedDealId,
      setDealSelectionBlocked,
      setQuoteDealId,
    ],
  );

  const routeFinanceActions = useMemo<AppRouteFinanceActions>(
    () => ({
      onAddPayment: handleAddPayment,
      onUpdatePayment: handleUpdatePayment,
      onDeletePayment: handleDeletePayment,
      onAddFinancialRecord: handleAddFinancialRecord,
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
      onLoadMoreDeals: loadMoreDeals,
      dealsHasMore,
      dealsTotalCount,
      isLoadingMoreDeals,
      isRefreshingDealsList,
      onLoadMorePolicies: loadMorePolicies,
      policiesHasMore,
      isLoadingMorePolicies,
      isPoliciesListLoading,
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
      hasCommissionsSnapshotLoaded,
      isCommissionsDataLoading,
      hasFinanceSnapshotLoaded,
      isFinanceDataLoading,
      isLoadingMoreDeals,
      isRefreshingDealsList,
      isLoadingMorePolicies,
      isPoliciesListLoading,
      isSelectedDealQuotesLoading,
      isSelectedDealTasksLoading,
      isTasksLoading,
      loadMoreDeals,
      loadMorePolicies,
      policiesHasMore,
    ],
  );
  const routeBindings = useAppRouteBindings({
    routeData,
    routeDealsActions,
    routeFilters,
    routeFinanceActions,
    routeLoading,
  });

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
      topSlot={
        activeShortcutContext ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-sky-900">
              {activeShortcutContext.title}: выбрано для хоткеев
            </span>
            <span className="rounded-lg border border-sky-200 bg-white px-2 py-1 font-medium text-slate-800">
              {activeShortcutContext.label}
            </span>
            <span className="text-sky-800">
              {formatShortcut('alt+arrowup')} / {formatShortcut('alt+arrowdown')} — переключить
            </span>
            <span className="text-sky-800">{formatShortcut('mod+o')} — открыть</span>
            {(isDealsRoute || isClientsRoute) && (
              <span className="text-sky-800">{formatShortcut('mod+backspace')} — удалить</span>
            )}
            {isDealsRoute && (
              <span className="text-sky-800">{formatShortcut('mod+shift+r')} — восстановить</span>
            )}
            {isTasksRoute && (
              <span className="text-sky-800">
                {formatShortcut('mod+enter')} — отметить выполненной
              </span>
            )}
          </div>
        ) : null
      }
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
        hotkeyHelpItems={HOTKEY_HELP_ITEMS}
        taskDealItems={taskDealItems}
        onClose={closePalette}
      />

      <Suspense fallback={null}>
        <AppDealPreviewModal
          isOpen={Boolean(previewDealId)}
          previewDeal={previewDeal}
          previewClient={previewClient}
          previewSellerUser={previewSellerUser}
          previewExecutorUser={previewExecutorUser}
          onClose={handleCloseDealPreview}
          panelProps={{
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
            onRequestAddQuote: (dealId) => setQuoteDealId(dealId),
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
            onAddFinancialRecord: handleAddFinancialRecord,
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
          }}
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
      </Suspense>
      {quickTaskDeal && (
        <Modal
          title={`Новая задача: ${quickTaskDeal.title}`}
          onClose={() => setQuickTaskDealId(null)}
          size="sm"
          zIndex={60}
          closeOnOverlayClick={false}
        >
          <AddTaskForm
            dealId={quickTaskDeal.id}
            users={users}
            defaultAssigneeId={quickTaskDeal.executor ?? null}
            onSubmit={async (data) => {
              await handleCreateTask(quickTaskDeal.id, data);
              setQuickTaskDealId(null);
            }}
            onCancel={() => setQuickTaskDealId(null)}
          />
        </Modal>
      )}
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
        <FormModal
          isOpen
          title="Удалить клиента"
          onClose={() => setClientDeleteTarget(null)}
          closeOnOverlayClick={false}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleDeleteClient();
            }}
            className="space-y-4"
          >
            <p className="text-sm text-slate-700">
              Клиент <span className="font-bold">{clientDeleteTarget.name}</span> и все его данные
              станут недоступны.
            </p>
            <FormActions
              onCancel={() => setClientDeleteTarget(null)}
              isSubmitting={isSyncing}
              submitLabel="Удалить"
              submittingLabel="Удаляем..."
              submitClassName={`${BTN_DANGER} rounded-xl`}
              cancelClassName={`${BTN_SECONDARY} rounded-xl`}
            />
          </form>
        </FormModal>
      )}
      <Suspense fallback={null}>
        <SimilarClientsModal
          isOpen={Boolean(similarClientTargetId)}
          targetClient={similarTargetClient}
          candidates={similarCandidates}
          isLoading={isSimilarClientsLoading}
          error={similarClientsError}
          onClose={closeSimilarClientsModal}
          onMerge={handleMergeFromSimilar}
        />
        {mergeTargetClient && (
          <ClientMergeModal
            targetClient={mergeTargetClient}
            mergeCandidates={mergeCandidates}
            mergeSearch={mergeSearch}
            mergeSources={mergeSources}
            mergeStep={clientMergeStep}
            mergePreview={clientMergePreview}
            mergeError={mergeError}
            isMergingClients={isMergingClients}
            isPreviewLoading={isClientMergePreviewLoading}
            isPreviewConfirmed={isClientMergePreviewConfirmed}
            fieldOverrides={clientMergeFieldOverrides}
            onClose={closeMergeModal}
            onSubmit={handleMergeSubmit}
            onPreview={handleClientMergePreview}
            onToggleSource={toggleMergeSource}
            onSearchChange={setMergeSearch}
            onFieldOverridesChange={setClientMergeFieldOverrides}
          />
        )}
      </Suspense>
      <ConfirmDialogRenderer />
    </AppShell>
  );
};

export default AppContent;
