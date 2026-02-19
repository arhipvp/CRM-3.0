import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
import { LoginPage } from './components/LoginPage';
import { useNotification } from './contexts/NotificationContext';
import { NotificationDisplay } from './components/NotificationDisplay';
import { AppModals } from './components/app/AppModals';
import { AppRoutes } from './components/app/AppRoutes';
import { ClientForm } from './components/forms/ClientForm';
import { AddTaskForm } from './components/forms/AddTaskForm';
import { PanelMessage } from './components/PanelMessage';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from './components/common/buttonStyles';
import { FormActions } from './components/common/forms/FormActions';
import { FormModal } from './components/common/modal/FormModal';
import type { AddTaskFormValues } from './components/forms/AddTaskForm';
import type { DealFormValues } from './components/forms/DealForm';
import type { QuoteFormValues } from './components/forms/AddQuoteForm';
import { Modal } from './components/Modal';
import { DealDetailsPanel } from './components/views/dealsView/DealDetailsPanel';
import { formatErrorMessage } from './utils/formatErrorMessage';
import { markTaskAsDeleted } from './utils/tasks';
import {
  createClient,
  updateClient,
  deleteClient,
  mergeClients,
  previewClientMerge,
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
  pinDeal,
  unpinDeal,
  mergeDeals,
  fetchDealHistory,
  fetchTasksByDeal,
  fetchQuotesByDeal,
  createTask,
  updateTask,
  deleteTask,
  clearTokens,
  APIError,
  fetchDeal,
  createDealMailbox,
  checkDealMailbox,
  createPolicy,
  updatePolicy,
  deletePolicy,
  createPayment,
  updatePayment,
  deletePayment,
  createFinancialRecord,
  updateFinancialRecord,
  deleteFinancialRecord,
  createFinanceStatement,
  updateFinanceStatement,
  deleteFinanceStatement,
  removeFinanceStatementRecords,
} from './api';
import type { FilterParams } from './api';
import {
  Client,
  ClientMergePreviewResponse,
  Deal,
  FinancialRecord,
  Payment,
  Policy,
  Quote,
  Statement,
  User,
} from './types';
import { useAppData } from './hooks/useAppData';
import { useAuthBootstrap } from './hooks/useAuthBootstrap';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useDealFilters } from './hooks/useDealFilters';
import { useConfirm } from './hooks/useConfirm';
import { confirmTexts } from './constants/confirmTexts';
import type { AddPaymentFormValues } from './components/forms/AddPaymentForm';
import type { AddFinancialRecordFormValues } from './components/forms/AddFinancialRecordForm';
import type { PolicyFormValues } from './components/forms/addPolicy/types';
import type { ModalType } from './components/app/types';
import type { FinancialRecordModalState, PaymentModalState } from './types';
import { normalizePaymentDraft } from './utils/normalizePaymentDraft';
import { markQuoteAsDeleted } from './utils/quotes';
import { parseNumericAmount } from './utils/parseNumericAmount';
import { formatAmountValue, matchSalesChannel, parseAmountValue } from './utils/appContent';
import { buildPolicyDraftFromRecognition, normalizeStringValue } from './utils/policyRecognition';
import {
  buildCommissionIncomeNote,
  resolveSalesChannelName,
  shouldAutofillCommissionNote,
} from './utils/financialRecordNotes';
import { CommandPalette, type CommandPaletteItem } from './components/common/modal/CommandPalette';
import { formatShortcut } from './hotkeys/formatShortcut';
import { useGlobalHotkeys } from './hotkeys/useGlobalHotkeys';

type PaletteMode = null | 'commands' | 'help' | 'taskDeal';

const NAVIGATION_COMMANDS: Array<{ path: string; label: string }> = [
  { path: '/seller-dashboard', label: 'Дашборд продавца' },
  { path: '/deals', label: 'Сделки' },
  { path: '/clients', label: 'Клиенты' },
  { path: '/policies', label: 'Полисы' },
  { path: '/commissions', label: 'Доходы и расходы' },
  { path: '/tasks', label: 'Задачи' },
  { path: '/settings', label: 'Настройки' },
];

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

const PALETTE_HINT_SESSION_KEY = 'crm_hotkeys_palette_hint_seen';

const AppContent: React.FC = () => {
  const { addNotification } = useNotification();
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const [modal, setModal] = useState<ModalType>(null);
  const [isClientModalOverlayOpen, setClientModalOverlayOpen] = useState(false);
  const [clientModalReturnTo, setClientModalReturnTo] = useState<ModalType | null>(null);
  const [pendingDealClientId, setPendingDealClientId] = useState<string | null>(null);
  const openClientModal = useCallback((afterModal: ModalType | null = null) => {
    if (afterModal) {
      setClientModalOverlayOpen(true);
      setClientModalReturnTo(afterModal);
      return;
    }
    setClientModalReturnTo(null);
    setModal('client');
  }, []);

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
  const [policyDefaultCounterparty, setPolicyDefaultCounterparty] = useState<string | undefined>(
    undefined,
  );
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
  const [isClientMergePreviewLoading, setIsClientMergePreviewLoading] = useState(false);
  const [clientMergePreview, setClientMergePreview] = useState<ClientMergePreviewResponse | null>(
    null,
  );
  const [isClientMergePreviewConfirmed, setIsClientMergePreviewConfirmed] = useState(false);
  const [clientMergeStep, setClientMergeStep] = useState<'select' | 'preview'>('select');
  const [clientMergeFieldOverrides, setClientMergeFieldOverrides] = useState<{
    name: string;
    phone: string;
    email: string;
    notes: string;
  }>({
    name: '',
    phone: '',
    email: '',
    notes: '',
  });
  const {
    dataState,
    loadData,
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
  const navigate = useNavigate();
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [isDealFocusCleared, setIsDealFocusCleared] = useState(false);
  const clearSelectedDealFocus = useCallback(() => {
    setSelectedDealId(null);
    setIsDealFocusCleared(true);
  }, []);
  const selectDealById = useCallback((dealId: string) => {
    setSelectedDealId(dealId);
    setIsDealFocusCleared(false);
  }, []);
  const [isDealSelectionBlocked, setDealSelectionBlocked] = useState(false);
  const [previewDealId, setPreviewDealId] = useState<string | null>(null);
  const [quickTaskDealId, setQuickTaskDealId] = useState<string | null>(null);
  const [paletteMode, setPaletteMode] = useState<PaletteMode>(null);
  const location = useLocation();
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const dealId = params.get('dealId');
    if (dealId) {
      selectDealById(dealId);
    }
  }, [location.search, selectDealById]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (location.pathname.startsWith('/commissions')) {
      refreshPolicies().catch((err) => {
        setError(formatErrorMessage(err, 'Ошибка при загрузке полисов'));
      });
    }
  }, [isAuthenticated, location.pathname, refreshPolicies, setError]);

  const dealsById = useMemo(() => {
    const map = new Map<string, Deal>();
    deals.forEach((deal) => {
      map.set(deal.id, deal);
    });
    return map;
  }, [deals]);
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
  const getDealExecutorName = useCallback(
    (dealId: string | null) => (dealId ? (dealsById.get(dealId)?.executorName ?? null) : null),
    [dealsById],
  );
  const policyDealExecutorName = getDealExecutorName(policyDealId);
  const editingPolicyExecutorName = getDealExecutorName(editingPolicy?.dealId ?? null);
  const searchInitialized = useRef(false);
  const skipNextMissingSelectedDealClearRef = useRef<string | null>(null);

  const refreshDealsWithSelection = useCallback(
    async (filters?: FilterParams, options?: { force?: boolean }) => {
      const dealsData = await refreshDeals(filters, options);
      if (selectedDealId && dealsData.some((deal) => deal.id === selectedDealId)) {
        if (skipNextMissingSelectedDealClearRef.current === selectedDealId) {
          skipNextMissingSelectedDealClearRef.current = null;
        }
        return dealsData;
      }
      if (selectedDealId && !dealsData.some((deal) => deal.id === selectedDealId)) {
        if (skipNextMissingSelectedDealClearRef.current === selectedDealId) {
          skipNextMissingSelectedDealClearRef.current = null;
          return dealsData;
        }
        clearSelectedDealFocus();
      }
      return dealsData;
    },
    [clearSelectedDealFocus, refreshDeals, selectedDealId],
  );

  const syncDealsByIds = useCallback(
    async (dealIds: (string | null | undefined)[]) => {
      const normalizedIds = Array.from(new Set(dealIds.filter((id): id is string => Boolean(id))));
      if (!normalizedIds.length) {
        return;
      }
      const fetchedDeals = await Promise.all(normalizedIds.map((dealId) => fetchDeal(dealId)));
      updateAppData((prev) => {
        const dealMap = new Map<string, Deal>(fetchedDeals.map((deal) => [deal.id, deal]));
        const existingIds = new Set(prev.deals.map((deal) => deal.id));
        const updatedDeals = prev.deals.map((deal) => dealMap.get(deal.id) ?? deal);
        const missingDeals = fetchedDeals.filter((deal) => !existingIds.has(deal.id));
        return { deals: [...updatedDeals, ...missingDeals] };
      });
      invalidateDealsCache();
    },
    [invalidateDealsCache, updateAppData],
  );

  const handleSelectDeal = useCallback(
    (dealId: string) => {
      if (isDealSelectionBlocked) {
        return;
      }
      selectDealById(dealId);
      if (!dealId || dealsById.has(dealId)) {
        return;
      }
      syncDealsByIds([dealId]).catch((err) => {
        setError(formatErrorMessage(err, 'Не удалось загрузить сделку'));
      });
    },
    [dealsById, isDealSelectionBlocked, selectDealById, setError, syncDealsByIds],
  );
  const handleOpenDealPreview = useCallback(
    (dealId: string) => {
      setPreviewDealId(dealId);
      handleSelectDeal(dealId);
    },
    [handleSelectDeal],
  );
  const handleRefreshSelectedDeal = useCallback(
    async (dealId: string) => {
      await syncDealsByIds([dealId]);
      await refreshDealsWithSelection(dealFilters, { force: true });
    },
    [dealFilters, refreshDealsWithSelection, syncDealsByIds],
  );
  const handleCloseDealPreview = useCallback(() => {
    setPreviewDealId(null);
  }, []);
  const previewDeal = previewDealId ? (dealsById.get(previewDealId) ?? null) : null;
  const previewClient = previewDeal ? (clientsById.get(previewDeal.clientId) ?? null) : null;
  const previewSellerUser = previewDeal ? usersById.get(previewDeal.seller ?? '') : undefined;
  const previewExecutorUser = previewDeal ? usersById.get(previewDeal.executor ?? '') : undefined;
  const quickTaskDeal = quickTaskDealId ? (dealsById.get(quickTaskDealId) ?? null) : null;
  const selectedDeal = selectedDealId ? (dealsById.get(selectedDealId) ?? null) : null;
  const isDealsRoute = location.pathname.startsWith('/deals');
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

  const openTaskCreateFlow = useCallback(() => {
    if (selectedDealId && dealsById.has(selectedDealId)) {
      setQuickTaskDealId(selectedDealId);
      return;
    }
    setPaletteMode('taskDeal');
  }, [dealsById, selectedDealId]);

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

  const handlePolicyDraftReady = useCallback(
    (
      dealId: string,
      parsed: Record<string, unknown>,
      _fileName?: string | null,
      fileId?: string | null,
      parsedFileIds?: string[],
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
          policyObj.salesChannelName,
      );
      const matchedChannel = matchSalesChannel(salesChannels, recognizedSalesChannel);
      const commissionNote = buildCommissionIncomeNote(matchedChannel?.name);
      const paymentsWithNotes = draft.payments.map((payment) => ({
        ...payment,
        incomes: payment.incomes.map((income) =>
          shouldAutofillCommissionNote(income.note) ? { ...income, note: commissionNote } : income,
        ),
      }));

      const recognizedInsuredName = normalizeStringValue(
        parsed.insured_client_name ??
          parsed.client_name ??
          policyObj.insured_client_name ??
          policyObj.client_name ??
          policyObj.client ??
          policyObj.insured_client ??
          policyObj.contractor,
      );
      const matchedInsuredClient = recognizedInsuredName?.length
        ? clients.find(
            (client) => client.name.toLowerCase() === recognizedInsuredName.toLowerCase(),
          )
        : undefined;

      const values = {
        ...draft,
        salesChannelId: matchedChannel?.id,
        payments: paymentsWithNotes,
        insuredClientId: matchedInsuredClient?.id ?? undefined,
        insuredClientName: matchedInsuredClient?.name ?? (recognizedInsuredName || undefined),
      };
      const recognizedInsuranceType = normalizeStringValue(
        policyObj.insurance_type ??
          policyObj.insuranceType ??
          parsed.insurance_type ??
          parsed.insuranceType,
      );
      setPolicyDealId(dealId);
      setPolicyDefaultCounterparty(undefined);
      const resolvedFileIds = parsedFileIds?.length
        ? Array.from(new Set(parsedFileIds.filter((id): id is string => Boolean(id))))
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
    [salesChannels, clients],
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
  }, [debouncedDealFilters, refreshDealsWithSelection, isAuthenticated, setError]);

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
    [closeClientModal, updateAppData, clientModalReturnTo],
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
          clients: prev.clients.map((client) => (client.id === updated.id ? updated : client)),
        }));
        addNotification('Клиент обновлён', 'success', 4000);
        setEditingClient(null);
        setError(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении клиента'));
        throw err;
      }
    },
    [addNotification, editingClient, setError, updateAppData],
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
    setClientMergePreview(null);
    setIsClientMergePreviewConfirmed(false);
    setClientMergeStep('select');
    setClientMergeFieldOverrides({
      name: client.name ?? '',
      phone: client.phone ?? '',
      email: client.email ?? '',
      notes: client.notes ?? '',
    });
  }, []);

  const toggleMergeSource = useCallback((clientId: string) => {
    setMergeSources((prev) =>
      prev.includes(clientId) ? prev.filter((id) => id !== clientId) : [...prev, clientId],
    );
    setMergeError(null);
    setClientMergePreview(null);
    setIsClientMergePreviewConfirmed(false);
    setClientMergeStep('select');
  }, []);

  const closeMergeModal = useCallback(() => {
    setMergeClientTargetId(null);
    setMergeSources([]);
    setMergeSearch('');
    setMergeError(null);
    setClientMergePreview(null);
    setIsClientMergePreviewConfirmed(false);
    setClientMergeStep('select');
    setClientMergeFieldOverrides({
      name: '',
      phone: '',
      email: '',
      notes: '',
    });
  }, []);

  const handleClientMergePreview = useCallback(async () => {
    if (!mergeClientTargetId) {
      return;
    }
    if (!mergeSources.length) {
      setMergeError('Выберите клиентов для объединения.');
      return;
    }
    setIsClientMergePreviewLoading(true);
    setMergeError(null);
    try {
      const preview = await previewClientMerge({
        targetClientId: mergeClientTargetId,
        sourceClientIds: mergeSources,
        includeDeleted: true,
      });
      setClientMergePreview(preview);
      setClientMergeFieldOverrides((prev) => ({
        name: prev.name || preview.canonicalProfile.name || '',
        phone: prev.phone || preview.canonicalProfile.phone || '',
        email: prev.email || preview.canonicalProfile.email || '',
        notes: prev.notes || preview.canonicalProfile.notes || '',
      }));
      setIsClientMergePreviewConfirmed(true);
      setClientMergeStep('preview');
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось получить предпросмотр объединения';
      setMergeError(message);
      setIsClientMergePreviewConfirmed(false);
    } finally {
      setIsClientMergePreviewLoading(false);
    }
  }, [mergeClientTargetId, mergeSources]);

  const handleMergeSubmit = useCallback(async () => {
    if (!mergeClientTargetId) {
      return;
    }
    if (!mergeSources.length) {
      setMergeError('Выберите клиентов для объединения.');
      return;
    }
    if (!isClientMergePreviewConfirmed || !clientMergePreview) {
      setMergeError('Сначала выполните предпросмотр объединения.');
      return;
    }
    if (!clientMergeFieldOverrides.name.trim()) {
      setMergeError('Укажите итоговое ФИО клиента.');
      return;
    }
    setIsSyncing(true);
    setIsMergingClients(true);
    try {
      const previewSnapshotId = String(clientMergePreview.previewSnapshotId ?? '');
      const result = await mergeClients({
        targetClientId: mergeClientTargetId,
        sourceClientIds: mergeSources,
        includeDeleted: true,
        previewSnapshotId,
        fieldOverrides: {
          name: clientMergeFieldOverrides.name,
          phone: clientMergeFieldOverrides.phone,
          email: clientMergeFieldOverrides.email || null,
          notes: clientMergeFieldOverrides.notes,
        },
      });
      const mergedIds = new Set(result.mergedClientIds);
      updateAppData((prev) => ({
        clients: prev.clients
          .filter((client) => !mergedIds.has(client.id))
          .map((client) => (client.id === result.targetClient.id ? result.targetClient : client)),
        deals: prev.deals.map((deal) =>
          mergedIds.has(deal.clientId)
            ? {
                ...deal,
                clientId: result.targetClient.id,
                clientName: result.targetClient.name,
              }
            : deal,
        ),
        policies: prev.policies.map((policy) => {
          const policyClientId = policy.clientId ?? '';
          const insuredClientId = policy.insuredClientId ?? '';
          const shouldUpdatePrimary = Boolean(policyClientId && mergedIds.has(policyClientId));
          const shouldUpdateInsured = Boolean(insuredClientId && mergedIds.has(insuredClientId));
          if (!shouldUpdatePrimary && !shouldUpdateInsured) {
            return policy;
          }
          return {
            ...policy,
            clientId: shouldUpdatePrimary ? result.targetClient.id : policy.clientId,
            clientName: shouldUpdatePrimary ? result.targetClient.name : policy.clientName,
            insuredClientId: shouldUpdateInsured ? result.targetClient.id : policy.insuredClientId,
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
    clientMergeFieldOverrides.email,
    clientMergeFieldOverrides.name,
    clientMergeFieldOverrides.notes,
    clientMergeFieldOverrides.phone,
    clientMergePreview,
    closeMergeModal,
    isClientMergePreviewConfirmed,
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
    ? (clients.find((client) => client.id === mergeClientTargetId) ?? null)
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
        visibleUserIds: data.visibleUserIds,
      });
      updateAppData((prev) => ({ deals: [created, ...prev.deals] }));
      skipNextMissingSelectedDealClearRef.current = created.id;
      selectDealById(created.id);
      setModal(null);
    },
    [invalidateDealsCache, selectDealById, setModal, updateAppData],
  );

  const handleCloseDeal = useCallback(
    async (dealId: string, payload: { reason: string; status?: 'won' | 'lost' }) => {
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
    [invalidateDealsCache, setError, setIsSyncing, updateAppData],
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
        selectDealById(updated.id);
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
    [addNotification, invalidateDealsCache, setError, setIsSyncing, selectDealById, updateAppData],
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
        selectDealById(updated.id);
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
    [addNotification, invalidateDealsCache, setError, setIsSyncing, selectDealById, updateAppData],
  );

  const handlePinDeal = useCallback(
    async (dealId: string) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        await pinDeal(dealId);
        await refreshDealsWithSelection(dealFilters, { force: true });
        addNotification('Сделка закреплена', 'success', 3000);
      } catch (err) {
        if (err instanceof APIError && err.status === 400) {
          addNotification(err.message || 'Нельзя закрепить больше 5 сделок', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Ошибка при закреплении сделки'));
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
      refreshDealsWithSelection,
      setError,
      setIsSyncing,
    ],
  );

  const handleUnpinDeal = useCallback(
    async (dealId: string) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        await unpinDeal(dealId);
        await refreshDealsWithSelection(dealFilters, { force: true });
        addNotification('Сделка откреплена', 'success', 3000);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при откреплении сделки'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      addNotification,
      dealFilters,
      invalidateDealsCache,
      refreshDealsWithSelection,
      setError,
      setIsSyncing,
    ],
  );

  const handlePostponeDeal = useCallback(
    async (dealId: string, data: DealFormValues) => {
      invalidateDealsCache();
      const previousSelection = selectedDealId;
      const previousFocusCleared = isDealFocusCleared;
      setIsSyncing(true);
      try {
        await updateDeal(dealId, data);
        await refreshDeals(dealFilters, { force: true });
        clearSelectedDealFocus();
      } catch (err) {
        if (previousSelection) {
          selectDealById(previousSelection);
        } else if (previousFocusCleared) {
          clearSelectedDealFocus();
        } else {
          setSelectedDealId(null);
          setIsDealFocusCleared(false);
        }
        if (err instanceof APIError && err.status === 403) {
          addNotification('Ошибка доступа при обновлении сделки', 'error', 4000);
        } else {
          setError(formatErrorMessage(err, 'Не удалось обновить сделку'));
        }
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [
      addNotification,
      clearSelectedDealFocus,
      dealFilters,
      invalidateDealsCache,
      isDealFocusCleared,
      refreshDeals,
      selectedDealId,
      selectDealById,
      setError,
      setIsDealFocusCleared,
      setIsSyncing,
    ],
  );
  const handleDeleteDeal = useCallback(
    async (dealId: string) => {
      const confirmed = await confirm(confirmTexts.deleteDeal());
      if (!confirmed) {
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
    [addNotification, confirm, dealFilters, refreshDealsWithSelection, setError, setIsSyncing],
  );

  const handleRestoreDeal = useCallback(
    async (dealId: string) => {
      setIsSyncing(true);
      try {
        const restored = await restoreDeal(dealId);
        await refreshDealsWithSelection(dealFilters, { force: true });
        selectDealById(restored.id);
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
    [
      addNotification,
      dealFilters,
      refreshDealsWithSelection,
      setError,
      selectDealById,
      setIsSyncing,
    ],
  );

  const cycleSelectedDeal = useCallback(
    (direction: 1 | -1) => {
      if (!isDealsRoute || !deals.length) {
        return;
      }

      if (!selectedDealId) {
        handleSelectDeal(deals[0].id);
        return;
      }

      const currentIndex = deals.findIndex((deal) => deal.id === selectedDealId);
      if (currentIndex < 0) {
        handleSelectDeal(deals[0].id);
        return;
      }

      const nextIndex = (currentIndex + direction + deals.length) % deals.length;
      handleSelectDeal(deals[nextIndex].id);
    },
    [deals, handleSelectDeal, isDealsRoute, selectedDealId],
  );

  const openSelectedDealPreview = useCallback(() => {
    if (!isDealsRoute || !selectedDeal?.id) {
      return;
    }
    handleOpenDealPreview(selectedDeal.id);
  }, [handleOpenDealPreview, isDealsRoute, selectedDeal?.id]);

  const deleteSelectedDeal = useCallback(async () => {
    if (!isDealsRoute || !selectedDeal?.id || selectedDeal.deletedAt) {
      return;
    }
    await handleDeleteDeal(selectedDeal.id);
  }, [handleDeleteDeal, isDealsRoute, selectedDeal]);

  const restoreSelectedDeal = useCallback(async () => {
    if (!isDealsRoute || !selectedDeal?.id || !selectedDeal.deletedAt) {
      return;
    }
    await handleRestoreDeal(selectedDeal.id);
  }, [handleRestoreDeal, isDealsRoute, selectedDeal]);

  const handleMergeDeals = useCallback(
    async (
      targetDealId: string,
      sourceDealIds: string[],
      resultingClientId?: string,
      previewSnapshotId?: string,
    ) => {
      invalidateDealsCache();
      setIsSyncing(true);
      try {
        const result = await mergeDeals({
          targetDealId,
          sourceDealIds,
          resultingClientId,
          includeDeleted: true,
          previewSnapshotId,
        });
        updateAppData((prev) => {
          const mergedIds = new Set(result.mergedDealIds);
          const targetDealId = result.targetDeal.id;
          const targetDealTitle = result.targetDeal.title;
          const targetClientName = result.targetDeal.clientName;

          return {
            deals: prev.deals
              .filter((deal) => !mergedIds.has(deal.id))
              .map((deal) => (deal.id === targetDealId ? result.targetDeal : deal)),
            policies: prev.policies.map((policy) =>
              mergedIds.has(policy.dealId)
                ? {
                    ...policy,
                    dealId: targetDealId,
                    dealTitle: targetDealTitle,
                  }
                : policy,
            ),
            payments: prev.payments.map((payment) =>
              payment.dealId && mergedIds.has(payment.dealId)
                ? {
                    ...payment,
                    dealId: targetDealId,
                    dealTitle: targetDealTitle,
                    dealClientName: targetClientName ?? payment.dealClientName,
                  }
                : payment,
            ),
            tasks: prev.tasks.map((task) =>
              task.dealId && mergedIds.has(task.dealId)
                ? {
                    ...task,
                    dealId: targetDealId,
                    dealTitle: targetDealTitle,
                    clientName: targetClientName ?? task.clientName,
                  }
                : task,
            ),
          };
        });
        selectDealById(result.targetDeal.id);
        setError(null);
        addNotification('Сделки объединены', 'success', 4000);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка объединения сделок'));
        throw err;
      } finally {
        setIsSyncing(false);
      }
    },
    [addNotification, invalidateDealsCache, setError, selectDealById, setIsSyncing, updateAppData],
  );

  const handleAddQuote = useCallback(
    async (dealId: string, values: QuoteFormValues) => {
      invalidateDealsCache();
      try {
        const created = await createQuote({ dealId, ...values });
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId ? { ...deal, quotes: [created, ...(deal.quotes ?? [])] } : deal,
          ),
        }));
        setQuoteDealId(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при добавлении предложения'));
        throw err;
      }
    },
    [invalidateDealsCache, setError, setQuoteDealId, updateAppData],
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
              : deal,
          ),
        }));
        setEditingQuote(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении предложения'));
        throw err;
      }
    },
    [editingQuote, invalidateDealsCache, setEditingQuote, setError, updateAppData],
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
              : deal,
          ),
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении предложения'));
        throw err;
      }
    },
    [invalidateDealsCache, setError, updateAppData],
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
        insuredClientName,
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
        let resolvedInsuredClientId = insuredClientId;
        const normalizedInsuredName = insuredClientName?.trim();
        if (!resolvedInsuredClientId && normalizedInsuredName) {
          const normalizedLower = normalizedInsuredName.toLowerCase();
          if (clientId && deal?.clientName?.toLowerCase() === normalizedLower) {
            resolvedInsuredClientId = clientId;
          } else {
            const matchedClient = clients.find(
              (client) => client.name.toLowerCase() === normalizedLower,
            );
            if (matchedClient) {
              resolvedInsuredClientId = matchedClient.id;
            } else {
              const createdClient = await createClient({ name: normalizedInsuredName });
              updateAppData((prev) => ({ clients: [createdClient, ...prev.clients] }));
              resolvedInsuredClientId = createdClient.id;
            }
          }
        }
        const created = await createPolicy({
          dealId,
          clientId,
          insuredClientId: resolvedInsuredClientId,
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
                : policy,
            ),
          }));
        };

        const hasCounterparty = Boolean(counterparty?.trim());
        const executorName = deal?.executorName?.trim();
        const hasExecutor = Boolean(executorName);
        const ensureExpenses = hasCounterparty || hasExecutor;
        const expenseTargetName = counterparty?.trim() || executorName || 'контрагент';
        const expenseNote = `Расход контрагенту ${expenseTargetName}`;
        const salesChannelName = resolveSalesChannelName(salesChannels, salesChannelId);
        const autoIncomeNote = buildCommissionIncomeNote(salesChannelName);
        const paymentsToProcess = paymentDrafts.map((payment) =>
          normalizePaymentDraft(payment, ensureExpenses, {
            autoIncomeNote,
            autoExpenseNote: ensureExpenses ? expenseNote : undefined,
          }),
        );

        let dealPaymentsTotalDelta = 0;
        let dealPaymentsPaidDelta = 0;
        let paymentsCreated = 0;

        try {
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
            paymentsCreated += 1;
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
        } catch (err) {
          if (paymentsCreated === 0) {
            try {
              await deletePolicy(created.id);
              updateAppData((prev) => ({
                policies: prev.policies.filter((policy) => policy.id !== created.id),
              }));
            } catch (cleanupErr) {
              console.error('Failed to delete policy after payment failure', cleanupErr);
            }
          }
          throw err;
        }

        if (dealPaymentsTotalDelta || dealPaymentsPaidDelta) {
          updateAppData((prev) => ({
            deals: adjustPaymentsTotals(
              prev.deals,
              dealId,
              dealPaymentsTotalDelta,
              dealPaymentsPaidDelta,
            ),
          }));
        }

        let refreshFailed = false;
        try {
          const refreshedDeal = await fetchDeal(dealId);
          updateAppData((prev) => ({
            deals: prev.deals.some((deal) => deal.id === refreshedDeal.id)
              ? prev.deals.map((deal) => (deal.id === refreshedDeal.id ? refreshedDeal : deal))
              : [refreshedDeal, ...prev.deals],
          }));
          selectDealById(refreshedDeal.id);
        } catch (refreshErr) {
          setError(
            refreshErr instanceof Error ? refreshErr.message : 'Не удалось обновить данные сделки',
          );
          refreshFailed = true;
        }

        try {
          await refreshPolicies();
        } catch (refreshErr) {
          setError(
            refreshErr instanceof Error ? refreshErr.message : 'Не удалось обновить список полисов',
          );
          refreshFailed = true;
        }
        try {
          await refreshDealsWithSelection(dealFilters, { force: true });
        } catch (refreshErr) {
          setError(
            refreshErr instanceof Error ? refreshErr.message : 'Не удалось обновить список сделок',
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
      clients,
      dealFilters,
      dealsById,
      invalidateDealsCache,
      policySourceFileIds,
      refreshDealsWithSelection,
      refreshPolicies,
      salesChannels,
      setError,
      setIsSyncing,
      selectDealById,
      updateAppData,
    ],
  );
  const handleRequestEditPolicy = useCallback(
    (policy: Policy) => {
      setModal(null);
      closePolicyModal();
      setEditingPolicy(policy);
    },
    [closePolicyModal, setModal],
  );
  const handleUpdatePolicy = useCallback(
    async (policyId: string, values: PolicyFormValues) => {
      setIsSyncing(true);
      invalidateDealsCache();
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
          insuredClientName,
          payments: paymentDrafts = [],
        } = values;

        const currentPolicy = policies.find((policy) => policy.id === policyId);
        if (!currentPolicy) {
          throw new Error('Не удалось найти полис для обновления.');
        }

        const statementById = new Map(
          (statements ?? []).map((statement) => [statement.id, statement]),
        );

        const existingPayments = payments.filter(
          (payment) => payment.policyId === policyId && !payment.deletedAt,
        );
        const existingPaymentById = new Map(
          existingPayments.map((payment) => [payment.id, payment]),
        );

        // Existing records are sourced primarily from `payments` because
        // `financialRecords` might be loaded partially (pagination on backend).
        const existingRecords = existingPayments
          .flatMap((payment) => payment.financialRecords ?? [])
          .filter((record) => !record.deletedAt);
        const existingRecordById = new Map(existingRecords.map((record) => [record.id, record]));

        const draftPaymentIds = new Set(
          paymentDrafts.map((draft) => draft.id).filter(Boolean) as string[],
        );
        const paymentsToDelete = existingPayments.filter(
          (payment) => !draftPaymentIds.has(payment.id),
        );

        const getRecordDraftIds = (draft: (typeof paymentDrafts)[number]) => {
          const ids: string[] = [];
          for (const income of draft.incomes ?? []) {
            if (income.id) ids.push(income.id);
          }
          for (const expense of draft.expenses ?? []) {
            if (expense.id) ids.push(expense.id);
          }
          return ids;
        };

        const isDraftStatementLinked = (recordId: string) => {
          const record = existingRecordById.get(recordId);
          if (!record?.statementId) {
            return false;
          }
          const statement = statementById.get(record.statementId);
          return Boolean(statement && !statement.paidAt);
        };

        // Fail fast: запрещаем удаление записей, привязанных к черновику ведомости.
        // Это предотвращает частичное сохранение, если далее будут сетевые запросы.
        for (const payment of paymentsToDelete) {
          const paymentRecords = existingRecords.filter(
            (record) => record.paymentId === payment.id,
          );
          const blocked = paymentRecords.find(
            (record) => record.statementId && isDraftStatementLinked(record.id),
          );
          if (blocked) {
            throw new Error('Сначала уберите запись из ведомости');
          }
        }
        for (const draft of paymentDrafts) {
          if (!draft.id) continue;
          const submittedRecordIds = new Set(getRecordDraftIds(draft));
          const paymentRecords = existingRecords.filter((record) => record.paymentId === draft.id);
          for (const record of paymentRecords) {
            if (!submittedRecordIds.has(record.id) && isDraftStatementLinked(record.id)) {
              throw new Error('Сначала уберите запись из ведомости');
            }
          }
        }

        let resolvedInsuredClientId = insuredClientId;
        const normalizedInsuredName = insuredClientName?.trim();
        if (!resolvedInsuredClientId && normalizedInsuredName) {
          const normalizedLower = normalizedInsuredName.toLowerCase();
          if (
            currentPolicy?.clientId &&
            currentPolicy?.clientName?.toLowerCase() === normalizedLower
          ) {
            resolvedInsuredClientId = currentPolicy.clientId;
          } else {
            const matchedClient = clients.find(
              (client) => client.name.toLowerCase() === normalizedLower,
            );
            if (matchedClient) {
              resolvedInsuredClientId = matchedClient.id;
            } else {
              const createdClient = await createClient({ name: normalizedInsuredName });
              updateAppData((prev) => ({ clients: [createdClient, ...prev.clients] }));
              resolvedInsuredClientId = createdClient.id;
            }
          }
        }
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
          insuredClientId: resolvedInsuredClientId,
        });
        updateAppData((prev) => ({
          policies: prev.policies.map((policy) => (policy.id === updated.id ? updated : policy)),
        }));

        const parsePaymentAmount = (value?: string | null) => {
          const parsed = parseNumericAmount(value ?? '');
          return Number.isFinite(parsed) ? parsed : 0;
        };

        const parseRecordAmount = (value: string | null | undefined, sign: 1 | -1) => {
          const parsed = parseNumericAmount(value ?? '');
          if (!Number.isFinite(parsed)) {
            return parsed;
          }
          const abs = Math.abs(parsed);
          return sign === -1 ? -abs : abs;
        };

        const affectedDealIds = new Set<string>();
        if (currentPolicy.dealId) {
          affectedDealIds.add(currentPolicy.dealId);
        }

        // 1) Удаляем платежи, которые исчезли из формы.
        for (const payment of paymentsToDelete) {
          await deletePayment(payment.id);
          const paymentAmount = parseAmountValue(payment.amount);
          const paymentPaid = payment.actualDate ? paymentAmount : 0;
          updateAppData((prev) => ({
            payments: prev.payments.filter((item) => item.id !== payment.id),
            financialRecords: prev.financialRecords.filter(
              (record) => record.paymentId !== payment.id,
            ),
            policies: adjustPaymentsTotals(
              prev.policies,
              payment.policyId,
              -paymentAmount,
              -paymentPaid,
            ),
            deals: adjustPaymentsTotals(prev.deals, payment.dealId, -paymentAmount, -paymentPaid),
          }));
        }

        // 2) Обновляем/создаем платежи и синхронизируем записи.
        for (const draft of paymentDrafts) {
          const draftAmount = parsePaymentAmount(draft.amount);
          const draftScheduled = draft.scheduledDate ? draft.scheduledDate : null;
          const draftActual = draft.actualDate ? draft.actualDate : null;
          const draftDescription = draft.description ?? '';

          let paymentId = draft.id;
          let paymentEntity = paymentId ? existingPaymentById.get(paymentId) : undefined;

          if (paymentId) {
            const previousPayment = paymentEntity;
            if (previousPayment) {
              const previousAmount = parseAmountValue(previousPayment.amount);
              const previousPaid = previousPayment.actualDate ? previousAmount : 0;
              const nextPaid = draftActual ? draftAmount : 0;

              const needsUpdate =
                parseAmountValue(previousPayment.amount) !== draftAmount ||
                (previousPayment.description ?? '') !== draftDescription ||
                (previousPayment.scheduledDate ?? null) !== draftScheduled ||
                (previousPayment.actualDate ?? null) !== draftActual;

              if (needsUpdate) {
                const updatedPayment = await updatePayment(paymentId, {
                  policyId,
                  dealId: currentPolicy.dealId ?? undefined,
                  amount: draftAmount,
                  description: draftDescription,
                  scheduledDate: draftScheduled,
                  actualDate: draftActual,
                });

                updateAppData((prev) => ({
                  payments: prev.payments.map((payment) =>
                    payment.id === updatedPayment.id ? updatedPayment : payment,
                  ),
                  policies: adjustPaymentsTotals(
                    prev.policies,
                    policyId,
                    draftAmount - previousAmount,
                    nextPaid - previousPaid,
                  ),
                  deals: adjustPaymentsTotals(
                    prev.deals,
                    currentPolicy.dealId,
                    draftAmount - previousAmount,
                    nextPaid - previousPaid,
                  ),
                }));
                paymentEntity = updatedPayment;
              }
            }
          } else {
            const createdPayment = await createPayment({
              dealId: currentPolicy.dealId,
              policyId,
              amount: draftAmount,
              description: draftDescription,
              scheduledDate: draftScheduled,
              actualDate: draftActual,
            });
            paymentId = createdPayment.id;
            paymentEntity = createdPayment;

            const paidDelta = createdPayment.actualDate ? draftAmount : 0;
            updateAppData((prev) => ({
              payments: [createdPayment, ...prev.payments],
              policies: adjustPaymentsTotals(prev.policies, policyId, draftAmount, paidDelta),
              deals: adjustPaymentsTotals(prev.deals, currentPolicy.dealId, draftAmount, paidDelta),
            }));
          }

          if (!paymentId) {
            continue;
          }

          const paymentRecords = existingRecords.filter((record) => record.paymentId === paymentId);
          const submittedIncomeIds = new Set(
            (draft.incomes ?? []).map((r) => r.id).filter(Boolean) as string[],
          );
          const submittedExpenseIds = new Set(
            (draft.expenses ?? []).map((r) => r.id).filter(Boolean) as string[],
          );
          const submittedRecordIds = new Set([...submittedIncomeIds, ...submittedExpenseIds]);

          const recordsToDelete = paymentRecords.filter(
            (record) => !submittedRecordIds.has(record.id),
          );
          for (const record of recordsToDelete) {
            await deleteFinancialRecord(record.id);
            updateAppData((prev) => ({
              financialRecords: prev.financialRecords.filter((item) => item.id !== record.id),
              payments: prev.payments.map((payment) =>
                payment.id === record.paymentId
                  ? {
                      ...payment,
                      financialRecords: (payment.financialRecords ?? []).filter(
                        (item) => item.id !== record.id,
                      ),
                    }
                  : payment,
              ),
            }));
          }

          const updateOrCreateRecord = async (
            recordDraft: (typeof draft.incomes)[number],
            sign: 1 | -1,
          ) => {
            const amount = parseRecordAmount(recordDraft.amount, sign);
            if (!Number.isFinite(amount)) {
              return;
            }

            const payload = {
              amount,
              date: recordDraft.date ? recordDraft.date : null,
              description: recordDraft.description ?? '',
              source: recordDraft.source ?? '',
              note: recordDraft.note ?? '',
            };

            if (recordDraft.id) {
              const existing = existingRecordById.get(recordDraft.id);
              if (existing) {
                const existingAmount = parseNumericAmount(existing.amount ?? '');
                const existingDate = existing.date ?? null;
                const existingDescription = (existing.description ?? '').trim();
                const existingSource = (existing.source ?? '').trim();
                const existingNote = (existing.note ?? '').trim();

                const nextDescription = (payload.description ?? '').trim();
                const nextSource = (payload.source ?? '').trim();
                const nextNote = (payload.note ?? '').trim();

                const hasChanges =
                  (Number.isFinite(existingAmount) ? existingAmount : 0) !== payload.amount ||
                  (existingDate ?? null) !== (payload.date ?? null) ||
                  existingDescription !== nextDescription ||
                  existingSource !== nextSource ||
                  existingNote !== nextNote;

                if (!hasChanges) {
                  return;
                }

                const statement = existing.statementId
                  ? statementById.get(existing.statementId)
                  : undefined;
                if (statement?.paidAt) {
                  // Avoid partial saves: user is trying to change a record inside a paid statement.
                  throw new Error('Нельзя изменять записи в выплаченной ведомости.');
                }
              }
              const updatedRecord = await updateFinancialRecord(recordDraft.id, payload);
              updateAppData((prev) => ({
                financialRecords: prev.financialRecords.map((record) =>
                  record.id === updatedRecord.id ? updatedRecord : record,
                ),
                payments: prev.payments.map((payment) =>
                  payment.id === updatedRecord.paymentId
                    ? {
                        ...payment,
                        financialRecords: (payment.financialRecords ?? []).map((record) =>
                          record.id === updatedRecord.id ? updatedRecord : record,
                        ),
                      }
                    : payment,
                ),
              }));
              return;
            }

            const createdRecord = await createFinancialRecord({
              paymentId,
              ...payload,
            });
            updateAppData((prev) => ({
              financialRecords: [createdRecord, ...prev.financialRecords],
              payments: prev.payments.map((payment) =>
                payment.id === createdRecord.paymentId
                  ? {
                      ...payment,
                      financialRecords: [...(payment.financialRecords ?? []), createdRecord],
                    }
                  : payment,
              ),
            }));
          };

          for (const income of draft.incomes ?? []) {
            await updateOrCreateRecord(income, 1);
          }
          for (const expense of draft.expenses ?? []) {
            await updateOrCreateRecord(expense, -1);
          }
        }

        if (affectedDealIds.size) {
          await syncDealsByIds(Array.from(affectedDealIds));
        }
        await refreshPolicies();
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
    [
      adjustPaymentsTotals,
      clients,
      invalidateDealsCache,
      payments,
      policies,
      refreshPolicies,
      setEditingPolicy,
      setError,
      setIsSyncing,
      statements,
      syncDealsByIds,
      updateAppData,
    ],
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
              (record) => !removedPaymentIds.has(record.paymentId),
            ),
          };
        });
      } catch (err) {
        setError(formatErrorMessage(err, 'Не удалось удалить полис'));
        throw err;
      }
    },
    [setError, updateAppData],
  );

  const handleDriveFolderCreated = useCallback(
    (dealId: string, folderId: string) => {
      invalidateDealsCache();
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) =>
          deal.id === dealId ? { ...deal, driveFolderId: folderId } : deal,
        ),
      }));
    },
    [invalidateDealsCache, updateAppData],
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
    [setError],
  );

  const handleCreateDealMailbox = useCallback(
    async (dealId: string) => {
      const result = await createDealMailbox(dealId);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) => (deal.id === result.deal.id ? result.deal : deal)),
      }));
      invalidateDealsCache();
      return result;
    },
    [invalidateDealsCache, updateAppData],
  );

  const handleCheckDealMailbox = useCallback(
    async (dealId: string) => {
      const result = await checkDealMailbox(dealId);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) => (deal.id === result.deal.id ? result.deal : deal)),
      }));
      invalidateDealsCache();
      return result;
    },
    [invalidateDealsCache, updateAppData],
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
    [setError],
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
    [setError],
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
    [setError, setIsSyncing, updateAppData],
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
    [addNotification, setError, setIsSyncing, updateAppData],
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
    [setError, updateAppData],
  );

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

  const loadDealTasks = useCallback(
    async (dealId: string) => {
      try {
        const dealTasks = await fetchTasksByDeal(dealId, { showDeleted: true });
        updateAppData((prev) => ({
          tasks: [...prev.tasks.filter((task) => task.dealId !== dealId), ...dealTasks],
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Error loading tasks for the deal'));
      }
    },
    [setError, updateAppData],
  );

  const loadDealQuotes = useCallback(
    async (dealId: string) => {
      try {
        const dealQuotes = await fetchQuotesByDeal(dealId, { showDeleted: true });
        updateAppData((prev) => ({
          deals: prev.deals.map((deal) =>
            deal.id === dealId ? { ...deal, quotes: dealQuotes } : deal,
          ),
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Error loading quotes for the deal'));
      }
    },
    [setError, updateAppData],
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
            paymentPaidAmount,
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
    [
      adjustPaymentsTotals,
      invalidateDealsCache,
      setError,
      setPaymentModal,
      syncDealsByIds,
      updateAppData,
    ],
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
              updatedPaid - previousPaid,
            );
          } else {
            if (previousPolicyId) {
              policies = adjustPaymentsTotals(
                policies,
                previousPolicyId,
                -previousAmount,
                -previousPaid,
              );
            }
            if (updated.policyId) {
              policies = adjustPaymentsTotals(
                policies,
                updated.policyId,
                updatedAmount,
                updatedPaid,
              );
            }
          }

          let deals = prev.deals;
          if (previousDealId && previousDealId === updated.dealId) {
            deals = adjustPaymentsTotals(
              deals,
              previousDealId,
              updatedAmount - previousAmount,
              updatedPaid - previousPaid,
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
              payment.id === updated.id ? updated : payment,
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
    [
      adjustPaymentsTotals,
      invalidateDealsCache,
      payments,
      setError,
      setPaymentModal,
      syncDealsByIds,
      updateAppData,
    ],
  );

  const handleDeletePayment = useCallback(
    async (paymentId: string) => {
      const payment = payments.find((item) => item.id === paymentId);
      if (!payment) {
        return;
      }
      const confirmed = await confirm(confirmTexts.deletePayment());
      if (!confirmed) {
        return;
      }
      try {
        await deletePayment(paymentId);
        const paymentAmount = parseAmountValue(payment.amount);
        const paymentPaid = payment.actualDate ? paymentAmount : 0;
        updateAppData((prev) => ({
          payments: prev.payments.filter((item) => item.id !== paymentId),
          financialRecords: prev.financialRecords.filter(
            (record) => record.paymentId !== paymentId,
          ),
          policies: adjustPaymentsTotals(
            prev.policies,
            payment.policyId,
            -paymentAmount,
            -paymentPaid,
          ),
          deals: adjustPaymentsTotals(prev.deals, payment.dealId, -paymentAmount, -paymentPaid),
        }));
        await syncDealsByIds([payment.dealId]);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении платежа'));
        throw err;
      }
    },
    [adjustPaymentsTotals, confirm, payments, setError, syncDealsByIds, updateAppData],
  );

  const normalizeFinancialRecordAmount = (values: AddFinancialRecordFormValues) => {
    const parsedAmount = parseFloat(values.amount);
    if (!Number.isFinite(parsedAmount)) {
      return parsedAmount;
    }
    return values.recordType === 'expense' ? -Math.abs(parsedAmount) : Math.abs(parsedAmount);
  };

  const applyStatementAggregates = (items: Statement[], records: FinancialRecord[]) => {
    const aggregates = new Map<string, { count: number; total: number }>();

    for (const record of records) {
      if (record.deletedAt) {
        continue;
      }
      const statementId = record.statementId ?? null;
      if (!statementId) {
        continue;
      }
      const amount = parseAmountValue(record.amount);
      const current = aggregates.get(statementId) ?? { count: 0, total: 0 };
      current.count += 1;
      current.total += Number.isFinite(amount) ? amount : 0;
      aggregates.set(statementId, current);
    }

    return items.map((statement) => {
      const aggregate = aggregates.get(statement.id) ?? { count: 0, total: 0 };
      return {
        ...statement,
        recordsCount: aggregate.count,
        totalAmount: aggregate.total.toFixed(2),
      };
    });
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
        updateAppData((prev) => {
          const financialRecords = [created, ...prev.financialRecords];
          const payments = prev.payments.map((payment) =>
            payment.id === created.paymentId
              ? {
                  ...payment,
                  financialRecords: [...(payment.financialRecords ?? []), created],
                }
              : payment,
          );
          const statements = applyStatementAggregates(prev.statements ?? [], financialRecords);
          return { financialRecords, payments, statements };
        });
        setFinancialRecordModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при создании записи'));
        throw err;
      }
    },
    [financialRecordModal, setError, setFinancialRecordModal, updateAppData],
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
        updateAppData((prev) => {
          const financialRecords = prev.financialRecords.map((record) =>
            record.id === updated.id ? updated : record,
          );
          const payments = prev.payments.map((payment) =>
            payment.id === updated.paymentId
              ? {
                  ...payment,
                  financialRecords: (payment.financialRecords ?? []).map((record) =>
                    record.id === updated.id ? updated : record,
                  ),
                }
              : payment,
          );
          const statements = applyStatementAggregates(prev.statements ?? [], financialRecords);
          return { financialRecords, payments, statements };
        });
        setFinancialRecordModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении записи'));
        throw err;
      }
    },
    [setError, setFinancialRecordModal, updateAppData],
  );

  const handleDeleteFinancialRecord = useCallback(
    async (recordId: string) => {
      try {
        await deleteFinancialRecord(recordId);
        updateAppData((prev) => {
          const existing = prev.financialRecords.find((record) => record.id === recordId);
          const financialRecords = prev.financialRecords.filter((record) => record.id !== recordId);
          const payments = existing
            ? prev.payments.map((payment) =>
                payment.id === existing.paymentId
                  ? {
                      ...payment,
                      financialRecords: (payment.financialRecords ?? []).filter(
                        (record) => record.id !== recordId,
                      ),
                    }
                  : payment,
              )
            : prev.payments;
          const statements = applyStatementAggregates(prev.statements ?? [], financialRecords);
          return { financialRecords, payments, statements };
        });
        setFinancialRecordModal(null);
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении записи'));
        throw err;
      }
    },
    [setError, setFinancialRecordModal, updateAppData],
  );

  const handleCreateFinanceStatement = useCallback(
    async (values: {
      name: string;
      statementType: Statement['statementType'];
      counterparty?: string;
      comment?: string;
      recordIds?: string[];
    }) => {
      const created = await createFinanceStatement({
        name: values.name,
        statementType: values.statementType,
        counterparty: values.counterparty,
        comment: values.comment,
        recordIds: values.recordIds,
      });
      updateAppData((prev) => {
        const recordIds = values.recordIds ?? [];
        if (!recordIds.length) {
          return {
            statements: [created, ...(prev.statements ?? [])],
          };
        }

        const recordIdSet = new Set(recordIds);
        const financialRecords = prev.financialRecords.map((record) =>
          recordIdSet.has(record.id) ? { ...record, statementId: created.id } : record,
        );
        const payments = prev.payments.map((payment) => ({
          ...payment,
          financialRecords: (payment.financialRecords ?? []).map((record) =>
            recordIdSet.has(record.id) ? { ...record, statementId: created.id } : record,
          ),
        }));
        const statements = applyStatementAggregates(
          [created, ...(prev.statements ?? [])],
          financialRecords,
        );
        return { statements, financialRecords, payments };
      });
      return created;
    },
    [updateAppData],
  );

  const handleUpdateFinanceStatement = useCallback(
    async (
      statementId: string,
      values: Partial<{
        name: string;
        statementType: Statement['statementType'];
        status: Statement['status'];
        counterparty: string;
        comment: string;
        paidAt: string | null;
        recordIds: string[];
      }>,
    ) => {
      const updated = await updateFinanceStatement(statementId, values);
      updateAppData((prev) => {
        let statements = (prev.statements ?? []).map((statement) =>
          statement.id === updated.id ? updated : statement,
        );
        const updatedRecordIds = values.recordIds ?? [];
        const recordIdSet = new Set(updatedRecordIds);
        const financialRecords = updatedRecordIds.length
          ? prev.financialRecords.map((record) =>
              recordIdSet.has(record.id) ? { ...record, statementId: updated.id } : record,
            )
          : prev.financialRecords;
        const payments = updatedRecordIds.length
          ? prev.payments.map((payment) => ({
              ...payment,
              financialRecords: (payment.financialRecords ?? []).map((record) =>
                recordIdSet.has(record.id) ? { ...record, statementId: updated.id } : record,
              ),
            }))
          : prev.payments;
        statements = applyStatementAggregates(statements, financialRecords);
        return { statements, financialRecords, payments };
      });
      return updated;
    },
    [updateAppData],
  );

  const handleDeleteFinanceStatement = useCallback(
    async (statementId: string) => {
      try {
        await deleteFinanceStatement(statementId);
        updateAppData((prev) => ({
          statements: (prev.statements ?? []).filter((statement) => statement.id !== statementId),
          financialRecords: prev.financialRecords.map((record) =>
            record.statementId === statementId ? { ...record, statementId: null } : record,
          ),
          payments: prev.payments.map((payment) => ({
            ...payment,
            financialRecords: (payment.financialRecords ?? []).map((record) =>
              record.statementId === statementId ? { ...record, statementId: null } : record,
            ),
          })),
        }));
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при удалении ведомости'));
        throw err;
      }
    },
    [setError, updateAppData],
  );

  const handleRemoveFinanceStatementRecords = useCallback(
    async (statementId: string, recordIds: string[]) => {
      try {
        await removeFinanceStatementRecords(statementId, recordIds);
        updateAppData((prev) => {
          const recordIdSet = new Set(recordIds);
          const financialRecords = prev.financialRecords.map((record) =>
            recordIdSet.has(record.id) ? { ...record, statementId: null } : record,
          );
          const payments = prev.payments.map((payment) => ({
            ...payment,
            financialRecords: (payment.financialRecords ?? []).map((record) =>
              recordIdSet.has(record.id) ? { ...record, statementId: null } : record,
            ),
          }));
          const statements = applyStatementAggregates(prev.statements ?? [], financialRecords);
          return { financialRecords, payments, statements };
        });
      } catch (err) {
        setError(formatErrorMessage(err, 'Ошибка при обновлении ведомости'));
        throw err;
      }
    },
    [setError, updateAppData],
  );

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

  const openCommandsPalette = useCallback(() => {
    setPaletteMode((prev) => (prev === 'commands' ? null : 'commands'));
  }, []);

  const openHelpPalette = useCallback(() => {
    setPaletteMode((prev) => (prev === 'help' ? null : 'help'));
  }, []);

  const closePalette = useCallback(() => {
    setPaletteMode(null);
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (typeof window === 'undefined') {
      return;
    }
    if (window.sessionStorage.getItem(PALETTE_HINT_SESSION_KEY) === '1') {
      return;
    }

    addNotification(
      `Откройте командную палитру: ${formatShortcut('mod+k')} (справка: ${formatShortcut('mod+/')})`,
      'success',
      7000,
    );
    window.sessionStorage.setItem(PALETTE_HINT_SESSION_KEY, '1');
  }, [addNotification, isAuthenticated]);

  const commandItems = useMemo<CommandPaletteItem[]>(
    () => [
      ...NAVIGATION_COMMANDS.map((item) => ({
        id: `nav-${item.path}`,
        title: item.label,
        subtitle: 'Перейти в раздел',
        keywords: [item.path, 'раздел', 'навигация'],
        onSelect: () => navigate(item.path),
      })),
      {
        id: 'create-deal',
        title: 'Новая сделка',
        subtitle: 'Создание',
        shortcut: formatShortcut('mod+shift+d'),
        keywords: ['сделка', 'создать'],
        onSelect: openDealCreateModal,
      },
      {
        id: 'create-client',
        title: 'Новый клиент',
        subtitle: 'Создание',
        shortcut: formatShortcut('mod+shift+c'),
        keywords: ['клиент', 'создать'],
        onSelect: openClientCreateModal,
      },
      {
        id: 'create-task',
        title: 'Новая задача',
        subtitle: 'Создание',
        shortcut: formatShortcut('mod+shift+t'),
        keywords: ['задача', 'создать'],
        onSelect: openTaskCreateFlow,
      },
      {
        id: 'show-hotkeys-help',
        title: 'Справка по горячим клавишам',
        subtitle: 'Помощь',
        shortcut: formatShortcut('mod+/'),
        keywords: ['шорткаты', 'горячие клавиши', 'помощь'],
        onSelect: () => {
          setPaletteMode('help');
          return false;
        },
      },
      ...(isDealsRoute && selectedDeal
        ? [
            {
              id: 'deal-open-preview',
              title: `Открыть сделку: ${selectedDeal.title}`,
              subtitle: 'Контекст сделки',
              shortcut: formatShortcut('mod+o'),
              keywords: ['сделка', 'открыть', 'превью'],
              onSelect: openSelectedDealPreview,
            },
            {
              id: 'deal-delete',
              title: `Удалить сделку: ${selectedDeal.title}`,
              subtitle: 'Контекст сделки',
              shortcut: formatShortcut('mod+backspace'),
              keywords: ['сделка', 'удалить'],
              disabled: Boolean(selectedDeal.deletedAt),
              onSelect: deleteSelectedDeal,
            },
            {
              id: 'deal-restore',
              title: `Восстановить сделку: ${selectedDeal.title}`,
              subtitle: 'Контекст сделки',
              shortcut: formatShortcut('mod+shift+r'),
              keywords: ['сделка', 'восстановить'],
              disabled: !selectedDeal.deletedAt,
              onSelect: restoreSelectedDeal,
            },
          ]
        : []),
      ...(isClientsRoute && selectedClientShortcut
        ? [
            {
              id: 'client-open-edit',
              title: `Открыть клиента: ${selectedClientShortcut.name}`,
              subtitle: 'Контекст клиентов',
              shortcut: formatShortcut('mod+o'),
              keywords: ['клиент', 'открыть', 'редактировать'],
              onSelect: openSelectedClient,
            },
            {
              id: 'client-delete',
              title: `Удалить клиента: ${selectedClientShortcut.name}`,
              subtitle: 'Контекст клиентов',
              shortcut: formatShortcut('mod+backspace'),
              keywords: ['клиент', 'удалить'],
              onSelect: deleteSelectedClient,
            },
          ]
        : []),
      ...(isPoliciesRoute && selectedPolicyShortcut
        ? [
            {
              id: 'policy-open-edit',
              title: `Открыть полис: ${selectedPolicyShortcut.number}`,
              subtitle: 'Контекст полисов',
              shortcut: formatShortcut('mod+o'),
              keywords: ['полис', 'открыть', 'редактировать'],
              onSelect: openSelectedPolicy,
            },
          ]
        : []),
      ...(isTasksRoute && selectedTaskShortcut
        ? [
            {
              id: 'task-open-deal-preview',
              title: `Открыть сделку задачи: ${selectedTaskShortcut.title}`,
              subtitle: 'Контекст задач',
              shortcut: formatShortcut('mod+o'),
              keywords: ['задача', 'сделка', 'открыть'],
              disabled: !selectedTaskShortcut.dealId,
              onSelect: openSelectedTaskDealPreview,
            },
            {
              id: 'task-mark-done',
              title: `Отметить выполненной: ${selectedTaskShortcut.title}`,
              subtitle: 'Контекст задач',
              shortcut: formatShortcut('mod+enter'),
              keywords: ['задача', 'выполнено', 'done'],
              disabled: selectedTaskShortcut.status === 'done',
              onSelect: markSelectedTaskDone,
            },
          ]
        : []),
    ],
    [
      deleteSelectedClient,
      deleteSelectedDeal,
      isClientsRoute,
      isDealsRoute,
      isPoliciesRoute,
      isTasksRoute,
      markSelectedTaskDone,
      navigate,
      openClientCreateModal,
      openDealCreateModal,
      openSelectedClient,
      openSelectedDealPreview,
      openSelectedPolicy,
      openSelectedTaskDealPreview,
      openTaskCreateFlow,
      restoreSelectedDeal,
      selectedClientShortcut,
      selectedDeal,
      selectedPolicyShortcut,
      selectedTaskShortcut,
    ],
  );

  const taskDealItems = useMemo<CommandPaletteItem[]>(() => {
    const candidates = deals
      .filter((deal) => !deal.deletedAt)
      .sort((left, right) => {
        const leftPinned = left.isPinned ? 1 : 0;
        const rightPinned = right.isPinned ? 1 : 0;
        if (leftPinned !== rightPinned) {
          return rightPinned - leftPinned;
        }
        return (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
      });

    return candidates.map((deal) => ({
      id: `task-deal-${deal.id}`,
      title: deal.title,
      subtitle: deal.clientName ? `Клиент: ${deal.clientName}` : 'Выбор сделки для задачи',
      keywords: [deal.clientName ?? '', deal.executorName ?? ''],
      onSelect: () => {
        selectDealById(deal.id);
        setQuickTaskDealId(deal.id);
      },
    }));
  }, [deals, selectDealById]);

  useGlobalHotkeys([
    {
      id: 'open-command-palette',
      combo: 'mod+k',
      handler: openCommandsPalette,
      allowInInput: true,
      enabled: isAuthenticated,
    },
    {
      id: 'open-hotkeys-help',
      combo: 'mod+/',
      handler: openHelpPalette,
      allowInInput: true,
      enabled: isAuthenticated,
    },
    {
      id: 'create-deal-hotkey',
      combo: 'mod+shift+d',
      handler: openDealCreateModal,
      enabled: isAuthenticated,
    },
    {
      id: 'create-client-hotkey',
      combo: 'mod+shift+c',
      handler: openClientCreateModal,
      enabled: isAuthenticated,
    },
    {
      id: 'create-task-hotkey',
      combo: 'mod+shift+t',
      handler: openTaskCreateFlow,
      enabled: isAuthenticated,
    },
    {
      id: 'context-prev-selection-hotkey',
      combo: 'alt+arrowup',
      handler: () => cycleActiveContextSelection(-1),
      enabled:
        isAuthenticated &&
        ((isDealsRoute && deals.length > 0) ||
          (isClientsRoute && sortedClientsForShortcuts.length > 0) ||
          (isPoliciesRoute && sortedPoliciesForShortcuts.length > 0) ||
          (isTasksRoute && sortedTasksForShortcuts.length > 0)),
    },
    {
      id: 'context-next-selection-hotkey',
      combo: 'alt+arrowdown',
      handler: () => cycleActiveContextSelection(1),
      enabled:
        isAuthenticated &&
        ((isDealsRoute && deals.length > 0) ||
          (isClientsRoute && sortedClientsForShortcuts.length > 0) ||
          (isPoliciesRoute && sortedPoliciesForShortcuts.length > 0) ||
          (isTasksRoute && sortedTasksForShortcuts.length > 0)),
    },
    {
      id: 'context-open-hotkey',
      combo: 'mod+o',
      handler: () => {
        void openPrimaryContextAction();
      },
      enabled:
        isAuthenticated &&
        ((isDealsRoute && selectedDeal?.id != null) ||
          (isClientsRoute && selectedClientShortcut != null) ||
          (isPoliciesRoute && selectedPolicyShortcut != null) ||
          (isTasksRoute && selectedTaskShortcut?.dealId != null)),
    },
    {
      id: 'context-delete-hotkey',
      combo: 'mod+backspace',
      handler: () => {
        void deletePrimaryContextAction();
      },
      enabled:
        isAuthenticated &&
        ((isDealsRoute && selectedDeal?.id != null && selectedDeal?.deletedAt == null) ||
          (isClientsRoute && selectedClientShortcut != null)),
    },
    {
      id: 'deals-restore-selected-hotkey',
      combo: 'mod+shift+r',
      handler: () => {
        void restoreSelectedDeal();
      },
      enabled:
        isAuthenticated &&
        isDealsRoute &&
        selectedDeal?.id != null &&
        selectedDeal?.deletedAt != null,
    },
    {
      id: 'tasks-mark-done-hotkey',
      combo: 'mod+enter',
      handler: () => {
        void markSelectedTaskDone();
      },
      enabled:
        isAuthenticated &&
        isTasksRoute &&
        selectedTaskShortcut != null &&
        selectedTaskShortcut.status !== 'done',
    },
    {
      id: 'close-palette-hotkey',
      combo: 'escape',
      handler: closePalette,
      allowInInput: true,
      enabled: isAuthenticated && paletteMode !== null,
    },
  ]);

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">{authLoading ? 'Загрузка...' : 'Загрузка данных...'}</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <MainLayout
      onAddDeal={openDealCreateModal}
      onAddClient={openClientCreateModal}
      onOpenCommandPalette={openCommandsPalette}
      currentUser={currentUser || undefined}
      onLogout={handleLogout}
    >
      {activeShortcutContext && (
        <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
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
        </div>
      )}
      <AppRoutes
        deals={deals}
        clients={clients}
        onClientEdit={handleClientEditRequest}
        onClientDelete={handleClientDeleteRequest}
        onClientMerge={handleClientMergeRequest}
        policies={policies}
        policiesList={policiesList}
        payments={payments}
        financialRecords={financialRecords}
        statements={statements}
        tasks={tasks}
        users={users}
        currentUser={currentUser}
        selectedDealId={selectedDealId}
        isDealFocusCleared={isDealFocusCleared}
        onSelectDeal={handleSelectDeal}
        onClearDealFocus={clearSelectedDealFocus}
        onDealPreview={handleOpenDealPreview}
        onCloseDeal={handleCloseDeal}
        onReopenDeal={handleReopenDeal}
        onUpdateDeal={handleUpdateDeal}
        onRefreshDeal={handleRefreshSelectedDeal}
        onPinDeal={handlePinDeal}
        onUnpinDeal={handleUnpinDeal}
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
        onDeletePayment={handleDeletePayment}
        onAddFinancialRecord={handleAddFinancialRecord}
        onUpdateFinancialRecord={handleUpdateFinancialRecord}
        onDeleteFinancialRecord={handleDeleteFinancialRecord}
        onCreateFinanceStatement={handleCreateFinanceStatement}
        onDeleteFinanceStatement={handleDeleteFinanceStatement}
        onUpdateFinanceStatement={handleUpdateFinanceStatement}
        onRemoveFinanceStatementRecords={handleRemoveFinanceStatementRecords}
        onDriveFolderCreated={handleDriveFolderCreated}
        onCreateDealMailbox={handleCreateDealMailbox}
        onCheckDealMailbox={handleCheckDealMailbox}
        onFetchChatMessages={handleFetchChatMessages}
        onSendChatMessage={handleSendChatMessage}
        onDeleteChatMessage={handleDeleteChatMessage}
        onFetchDealHistory={fetchDealHistory}
        onCreateTask={handleCreateTask}
        onUpdateTask={handleUpdateTask}
        onRefreshPolicies={refreshPolicies}
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
        onDealSelectionBlockedChange={setDealSelectionBlocked}
        onPolicyDraftReady={handlePolicyDraftReady}
        onLoadMoreDeals={loadMoreDeals}
        dealsHasMore={dealsHasMore}
        dealsTotalCount={dealsTotalCount}
        isLoadingMoreDeals={isLoadingMoreDeals}
        onRefreshPoliciesList={refreshPoliciesList}
        onLoadMorePolicies={loadMorePolicies}
        policiesHasMore={policiesHasMore}
        isLoadingMorePolicies={isLoadingMorePolicies}
        isPoliciesListLoading={isPoliciesListLoading}
      />
      <CommandPalette
        isOpen={paletteMode === 'commands'}
        title="Командная палитра"
        placeholder="Поиск по разделам и действиям..."
        items={commandItems}
        onClose={closePalette}
      />
      <CommandPalette
        isOpen={paletteMode === 'help'}
        title="Горячие клавиши"
        placeholder="Поиск по сочетаниям..."
        items={HOTKEY_HELP_ITEMS}
        onClose={closePalette}
      />
      <CommandPalette
        isOpen={paletteMode === 'taskDeal'}
        title="Выберите сделку для задачи"
        placeholder="Поиск сделки или клиента..."
        emptyMessage="Не найдено подходящих сделок для создания задачи."
        items={taskDealItems}
        onClose={closePalette}
      />

      {previewDealId && (
        <Modal
          title={previewDeal?.title ? `Сделка: ${previewDeal.title}` : 'Сделка'}
          onClose={handleCloseDealPreview}
          size="xl"
          zIndex={60}
        >
          <div className="max-h-[75vh] overflow-y-auto">
            {previewDeal ? (
              <DealDetailsPanel
                deals={deals}
                clients={clients}
                onClientEdit={handleClientEditRequest}
                policies={policies}
                payments={payments}
                financialRecords={financialRecords}
                tasks={tasks}
                users={users}
                currentUser={currentUser}
                sortedDeals={deals}
                selectedDeal={previewDeal}
                selectedClient={previewClient}
                sellerUser={previewSellerUser}
                executorUser={previewExecutorUser}
                onSelectDeal={handleSelectDeal}
                onCloseDeal={handleCloseDeal}
                onReopenDeal={handleReopenDeal}
                onUpdateDeal={handleUpdateDeal}
                onPostponeDeal={handlePostponeDeal}
                onMergeDeals={handleMergeDeals}
                onRequestAddQuote={(dealId) => setQuoteDealId(dealId)}
                onRequestEditQuote={handleRequestEditQuote}
                onRequestAddPolicy={handleRequestAddPolicy}
                onRequestEditPolicy={handleRequestEditPolicy}
                onRequestAddClient={() => openClientModal('deal')}
                onDeleteQuote={handleDeleteQuote}
                onDeletePolicy={handleDeletePolicy}
                onRefreshPolicies={refreshPolicies}
                onPolicyDraftReady={handlePolicyDraftReady}
                onAddPayment={handleAddPayment}
                onUpdatePayment={handleUpdatePayment}
                onDeletePayment={handleDeletePayment}
                onAddFinancialRecord={handleAddFinancialRecord}
                onUpdateFinancialRecord={handleUpdateFinancialRecord}
                onDeleteFinancialRecord={handleDeleteFinancialRecord}
                onDriveFolderCreated={handleDriveFolderCreated}
                onCreateDealMailbox={handleCreateDealMailbox}
                onCheckDealMailbox={handleCheckDealMailbox}
                onFetchChatMessages={handleFetchChatMessages}
                onSendChatMessage={handleSendChatMessage}
                onDeleteChatMessage={handleDeleteChatMessage}
                onFetchDealHistory={fetchDealHistory}
                onCreateTask={handleCreateTask}
                onUpdateTask={handleUpdateTask}
                onDeleteTask={handleDeleteTask}
                onDeleteDeal={handleDeleteDeal}
                onRestoreDeal={handleRestoreDeal}
                onDealSelectionBlockedChange={setDealSelectionBlocked}
              />
            ) : (
              <PanelMessage>Загрузка сделки...</PanelMessage>
            )}
          </div>
        </Modal>
      )}

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
      {mergeTargetClient && (
        <FormModal
          isOpen
          title={`Объединить клиента ${mergeTargetClient.name}`}
          onClose={closeMergeModal}
          size="lg"
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleMergeSubmit();
            }}
            className="space-y-5"
          >
            <p className="text-sm text-slate-600">
              Выберите клиентов, которые будут объединены в «{mergeTargetClient.name}».
            </p>
            {clientMergeStep === 'select' && (
              <>
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
              </>
            )}
            {clientMergeStep === 'preview' && clientMergePreview && (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-900">Предпросмотр объединения</p>
                <div className="grid grid-cols-1 gap-2 text-sm text-slate-700 md:grid-cols-2">
                  <p>Сделок к переносу: {String(clientMergePreview.movedCounts?.deals ?? 0)}</p>
                  <p>
                    Полисов к переносу:{' '}
                    {String(clientMergePreview.movedCounts?.policies_unique ?? 0)}
                  </p>
                </div>
                {Array.isArray(clientMergePreview.warnings) &&
                  clientMergePreview.warnings.length > 0 && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                        Предупреждения
                      </p>
                      <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
                        {clientMergePreview.warnings.map((warning) => (
                          <li key={String(warning)}>{String(warning)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    Итоговое ФИО
                    <input
                      type="text"
                      value={clientMergeFieldOverrides.name}
                      onChange={(event) =>
                        setClientMergeFieldOverrides((prev) => ({
                          ...prev,
                          name: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Итоговый телефон
                    <input
                      type="text"
                      value={clientMergeFieldOverrides.phone}
                      onChange={(event) =>
                        setClientMergeFieldOverrides((prev) => ({
                          ...prev,
                          phone: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                    />
                  </label>
                  <label className="text-sm text-slate-700">
                    Итоговый email
                    <input
                      type="email"
                      value={clientMergeFieldOverrides.email}
                      onChange={(event) =>
                        setClientMergeFieldOverrides((prev) => ({
                          ...prev,
                          email: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                    />
                  </label>
                  <label className="text-sm text-slate-700 md:col-span-2">
                    Итоговые заметки
                    <textarea
                      value={clientMergeFieldOverrides.notes}
                      onChange={(event) =>
                        setClientMergeFieldOverrides((prev) => ({
                          ...prev,
                          notes: event.target.value,
                        }))
                      }
                      className="mt-1 min-h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                    />
                  </label>
                </div>
              </div>
            )}
            {mergeError && <p className="text-sm text-rose-600">{mergeError}</p>}
            <FormActions
              onCancel={closeMergeModal}
              isSubmitting={isMergingClients}
              isSubmitDisabled={!mergeSources.length || !isClientMergePreviewConfirmed}
              submitLabel="Объединить клиентов"
              submittingLabel="Объединяем..."
              submitClassName={`${BTN_PRIMARY} rounded-xl`}
              cancelClassName={`${BTN_SECONDARY} rounded-xl`}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  void handleClientMergePreview();
                }}
                disabled={isClientMergePreviewLoading || !mergeSources.length}
                className={`${BTN_SECONDARY} rounded-xl`}
              >
                {isClientMergePreviewLoading
                  ? 'Готовим предпросмотр...'
                  : 'Предпросмотр объединения'}
              </button>
            </div>
          </form>
        </FormModal>
      )}
      <ConfirmDialogRenderer />
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
