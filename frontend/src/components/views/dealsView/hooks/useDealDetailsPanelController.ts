import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ActivityLog,
  ChatMessage,
  Client,
  ClientDuplicateHint,
  Deal,
  DealTimelineEvent,
  FinancialRecord,
  Payment,
  Policy,
  Quote,
  Task,
  User,
} from '../../../../types';
import type { DealMailboxCreateResult, DealMailboxSyncResult } from '../../../../api/deals';
import type { AddFinancialRecordFormValues } from '../../../forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../../../forms/AddPaymentForm';
import type { AddTaskFormValues } from '../../../forms/AddTaskForm';
import type { DealFormValues, PreselectedDealClient } from '../../../forms/DealForm';
import { useConfirm } from '../../../../hooks/useConfirm';
import { useFinancialRecordModal } from '../../../../hooks/useFinancialRecordModal';
import { usePaymentModal } from '../../../../hooks/usePaymentModal';
import { confirmTexts } from '../../../../constants/confirmTexts';
import { calculateNextContactForEvent } from '../eventDelay';
import { buildDealEventsFromTimeline, buildEventWindow } from '../eventUtils';
import { resolveExpectedCloseReason } from '../expectedCloseReason';
import {
  DealTabId,
  PolicySortKey,
  closedDealStatuses,
  formatDate,
  getDeadlineTone,
  getPolicySortValue,
  getUserDisplayName,
} from '../helpers';
import { useDealDetailsPanelActions } from './useDealDetailsPanelActions';
import { useDealCommunication } from './useDealCommunication';
import { useDealDriveFiles } from './useDealDriveFiles';
import { useDealInlineDates } from './useDealInlineDates';
import { useDealMerge } from './useDealMerge';
import { useDealNotes } from './useDealNotes';

export interface DealDetailsPanelProps {
  deals: Deal[];
  clients: Client[];
  onClientEdit?: (client: Client) => void;
  onClientOpenById?: (clientId: string) => Promise<void>;
  onClientFindSimilar?: (client: Client) => void;
  onClientNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
  policies: Policy[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  tasks: Task[];
  users: User[];
  currentUser: User | null;
  sortedDeals: Deal[];
  selectedDeal: Deal | null;
  selectedClient: Client | null;
  clientDuplicateHint?: ClientDuplicateHint;
  sellerUser?: User;
  executorUser?: User;
  onSelectDeal: (dealId: string) => void;
  onCloseDeal: (
    dealId: string,
    payload: { reason: string; status?: 'won' | 'lost' },
  ) => Promise<void>;
  onReopenDeal: (dealId: string) => Promise<void>;
  onUpdateDeal: (dealId: string, data: DealFormValues) => Promise<void>;
  onPostponeDeal?: (dealId: string, data: DealFormValues) => Promise<void>;
  onMergeDeals: (
    targetDealId: string,
    sourceDealIds: string[],
    finalDeal: DealFormValues,
    previewSnapshotId?: string,
  ) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
  onRequestEditQuote: (quote: Quote) => void;
  onRequestAddPolicy: (dealId: string) => void;
  onRequestEditPolicy: (policy: Policy) => void;
  onRequestAddClient: () => void;
  pendingDealClient?: PreselectedDealClient | null;
  onPendingDealClientConsumed?: () => void;
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onMovePolicy?: (policyId: string, targetDealId: string) => Promise<void>;
  onUpdatePolicyRenewed?: (policyId: string, isRenewed: boolean) => Promise<void>;
  onRefreshPolicies?: (options?: { force?: boolean }) => Promise<void>;
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null,
    fileId?: string | null,
    parsedFileIds?: string[],
  ) => void;
  onAddPayment: (values: AddPaymentFormValues) => Promise<void>;
  onUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  onDeletePayment: (paymentId: string) => Promise<void>;
  onMarkPaymentPaid?: (paymentId: string, actualDate: string) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onMarkFinancialRecordPaid?: (recordId: string, paidDate: string) => Promise<void>;
  onUpdateFinancialRecord: (
    recordId: string,
    values: AddFinancialRecordFormValues,
  ) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onDriveFolderCreated: (dealId: string, folderId: string) => void;
  onCreateDealMailbox: (dealId: string) => Promise<DealMailboxCreateResult>;
  onCheckDealMailbox: (dealId: string) => Promise<DealMailboxSyncResult>;
  onFetchChatMessages: (dealId: string, options?: RequestInit) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<ChatMessage>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (
    dealId: string,
    includeDeleted?: boolean,
    options?: RequestInit,
  ) => Promise<ActivityLog[]>;
  onFetchDealEvents: (
    dealId: string,
    includeDeleted?: boolean,
    options?: RequestInit,
  ) => Promise<DealTimelineEvent[]>;
  dealEventsRefreshToken?: number;
  onCreateDealEvent?: (
    dealId: string,
    data: {
      eventType?: 'manual_expected_close';
      eventDate: string;
      reason: string;
    },
  ) => Promise<DealTimelineEvent>;
  onUpdateDealEvent?: (
    dealId: string,
    eventId: string,
    data: { eventDate?: string; reason?: string },
  ) => Promise<DealTimelineEvent>;
  onDeleteDealEvent?: (dealId: string, eventId: string) => Promise<void>;
  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
  onRestoreDeal: (dealId: string) => Promise<void>;
  onClearDealFocus?: () => void;
  accessMessage?: string | null;
  onClearAccessMessage?: () => void;
  onRefreshDeal?: (dealId: string) => Promise<void>;
  isTasksLoading?: boolean;
  isQuotesLoading?: boolean;
  requestedTab?: DealTabId;
  onTabChange?: (tab: DealTabId) => void;
}

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

export function useDealDetailsPanelController({
  deals,
  clients,
  onClientEdit,
  onClientOpenById,
  onClientFindSimilar,
  onClientNormalizeName,
  policies,
  payments,
  financialRecords,
  tasks,
  users,
  currentUser,
  sortedDeals,
  selectedDeal,
  selectedClient,
  clientDuplicateHint,
  sellerUser,
  executorUser,
  onSelectDeal,
  onCloseDeal,
  onReopenDeal,
  onUpdateDeal,
  onPostponeDeal,
  onMergeDeals,
  onRequestAddQuote,
  onRequestEditQuote,
  onRequestAddPolicy,
  onRequestEditPolicy,
  onRequestAddClient,
  pendingDealClient,
  onPendingDealClientConsumed,
  onDeleteQuote,
  onDeletePolicy,
  onMovePolicy = async () => undefined,
  onUpdatePolicyRenewed = async () => undefined,
  onRefreshPolicies,
  onPolicyDraftReady,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onMarkPaymentPaid,
  onAddFinancialRecord,
  onMarkFinancialRecordPaid,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
  onDriveFolderCreated,
  onCreateDealMailbox,
  onCheckDealMailbox,
  onFetchChatMessages,
  onSendChatMessage,
  onDeleteChatMessage,
  onFetchDealHistory,
  onFetchDealEvents,
  dealEventsRefreshToken = 0,
  onCreateDealEvent = async () => {
    throw new Error('Создание событий недоступно');
  },
  onUpdateDealEvent = async () => {
    throw new Error('Редактирование событий недоступно');
  },
  onDeleteDealEvent = async () => {
    throw new Error('Удаление событий недоступно');
  },
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteDeal,
  onRestoreDeal,
  onClearDealFocus,
  accessMessage,
  onClearAccessMessage,
  requestedTab,
  onTabChange,
  onRefreshDeal,
  isTasksLoading = false,
  isQuotesLoading = false,
}: DealDetailsPanelProps) {
  const navigate = useNavigate();
  const { confirm, ConfirmDialogRenderer } = useConfirm();
  const loadDealEventsRef = useRef<() => Promise<void>>(async () => undefined);
  const sellerDisplayName = sellerUser
    ? getUserDisplayName(sellerUser)
    : selectedDeal?.sellerName || '—';
  const executorDisplayName = executorUser
    ? getUserDisplayName(executorUser)
    : selectedDeal?.executorName || '—';
  const headerExpectedCloseTone = getDeadlineTone(selectedDeal?.expectedClose);

  const isSelectedDealDeleted = Boolean(selectedDeal?.deletedAt);
  const isDealClosedStatus = Boolean(
    selectedDeal && closedDealStatuses.includes(selectedDeal.status),
  );
  const isCurrentUserSeller = Boolean(
    selectedDeal && currentUser && selectedDeal.seller === currentUser.id,
  );
  const currentUserIsAdmin = Boolean(currentUser?.roles?.includes('Admin'));
  const canReopenClosedDeal = Boolean(selectedDeal && (isCurrentUserSeller || currentUserIsAdmin));

  const {
    isMergeModalOpen,
    openMergeModal,
    closeMergeModal,
    mergeSources,
    mergeError,
    mergeSearch,
    setMergeSearch,
    mergeList,
    mergeQuery,
    isMergeSearchActive,
    isMergeSearchLoading,
    isMerging,
    isMergePreviewLoading,
    mergePreviewWarnings,
    isMergePreviewConfirmed,
    mergeStep,
    setMergeStep,
    mergeFinalDraft,
    toggleMergeSource,
    requestMergePreview,
    handleMergeSubmit,
    isSimilarModalOpen,
    openSimilarModal,
    closeSimilarModal,
    similarError,
    isSimilarLoading,
    similarCandidates,
    selectedSimilarIds,
    toggleSimilarCandidate,
    similarIncludeClosed,
    setSimilarIncludeClosed,
    continueFromSimilarToMerge,
  } = useDealMerge({
    deals,
    selectedDeal,
    currentUser,
    onMergeDeals,
  });

  const {
    notes,
    notesLoading,
    notesFilter,
    noteDraft,
    noteIsImportant,
    notesError,
    notesAction,
    noteAttachments,
    noteAttachmentsUploading,
    setNoteDraft,
    setNoteIsImportant,
    setNotesFilter,
    addNote: handleAddNote,
    attachNoteFile,
    removeNoteAttachment,
    archiveNote: handleArchiveNote,
    restoreNote: handleRestoreNote,
    reloadNotes,
  } = useDealNotes(selectedDeal?.id);
  const {
    isDriveLoading,
    driveError,
    selectedDriveFileIds,
    canRecognizeSelectedFiles,
    isRecognizing,
    recognitionResults,
    recognitionMessage,
    isTrashing,
    trashMessage,
    isDownloading,
    downloadMessage,
    isRenaming,
    renameMessage,
    isMoving,
    moveMessage,
    sortedDriveFiles,
    driveSortDirection,
    expandedFolderIds,
    loadDriveFiles,
    toggleFolderExpanded,
    isFolderLoading,
    getDriveFileDepth,
    handleDriveFileUpload,
    handleUploadAndRecognizePolicyFiles,
    toggleDriveFileSelection,
    toggleDriveSortDirection,
    handleRecognizePolicies,
    handleTrashSelectedFiles,
    handleTrashDriveFile,
    handleDownloadDriveFiles,
    getDriveFileBlob,
    handleRenameDriveFile,
    handleMoveDriveFiles,
    resetDriveState,
  } = useDealDriveFiles({
    selectedDeal,
    onDriveFolderCreated,
    onConfirmAction: async (message) => confirm(confirmTexts.deleteDriveFiles(message)),
    onConfirmDeleteFile: async (name, isFolder) =>
      confirm(isFolder ? confirmTexts.deleteDriveFolder(name) : confirmTexts.deleteDriveFile(name)),
    onRefreshPolicies,
    onPolicyDraftReady,
  });

  const {
    nextContactInputValue,
    expectedCloseInputValue,
    handleNextContactChange,
    handleNextContactBlur,
    handleQuickNextContactShift,
    quickInlinePostponeShift,
    quickInlineShift,
    quickInlineDateOptions,
    updateDealDates,
    postponeDealDates,
  } = useDealInlineDates({
    selectedDeal,
    sortedDeals,
    onUpdateDeal,
    onSelectDeal,
    onPostponeDeal,
  });

  const [policySortKey, setPolicySortKey] = useState<PolicySortKey>('startDate');
  const [policySortOrder, setPolicySortOrder] = useState<'asc' | 'desc'>('asc');
  const [isManualEventModalOpen, setIsManualEventModalOpen] = useState(false);
  const [manualEventDate, setManualEventDate] = useState(getTodayInputValue);
  const [manualEventReason, setManualEventReason] = useState('');
  const [manualEventError, setManualEventError] = useState<string | null>(null);
  const [isManualEventSaving, setIsManualEventSaving] = useState(false);

  const relatedPolicies = useMemo(
    () => (selectedDeal ? policies.filter((policy) => policy.dealId === selectedDeal.id) : []),
    [policies, selectedDeal],
  );

  const relatedPayments = useMemo(() => {
    if (!selectedDeal) {
      return [];
    }
    const relatedPolicyIds = new Set(relatedPolicies.map((policy) => policy.id));
    return payments.filter(
      (payment) =>
        payment.dealId === selectedDeal.id ||
        (payment.policyId ? relatedPolicyIds.has(payment.policyId) : false),
    );
  }, [payments, relatedPolicies, selectedDeal]);

  const relatedTasks = useMemo(
    () => (selectedDeal ? tasks.filter((task) => task.dealId === selectedDeal.id) : []),
    [selectedDeal, tasks],
  );

  const sortedPolicies = useMemo(() => {
    const normalized = [...relatedPolicies];
    const multiplier = policySortOrder === 'asc' ? 1 : -1;
    normalized.sort((left, right) => {
      const valueA = getPolicySortValue(left, policySortKey);
      const valueB = getPolicySortValue(right, policySortKey);
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * multiplier;
      }
      return (
        String(valueA ?? '').localeCompare(String(valueB ?? ''), 'ru-RU', {
          sensitivity: 'base',
        }) * multiplier
      );
    });
    return normalized;
  }, [policySortKey, policySortOrder, relatedPolicies]);

  const displayedTasks = useMemo(() => {
    const active = relatedTasks.filter((task) => task.status !== 'done');
    const done = relatedTasks.filter((task) => task.status === 'done');
    return [...active, ...done];
  }, [relatedTasks]);

  const {
    actionError,
    activeTab,
    closeDealReason,
    closeDealReasonError,
    completingTaskIds,
    dealRefreshError,
    delayLeadDays,
    delayLeadDaysLoading,
    editingTask,
    editingTaskId,
    isCheckingMailbox,
    isCloseDealPromptOpen,
    isClosingDeal,
    isCreatingMailbox,
    isCreatingTask,
    isDealRefreshing,
    isDeletingDeal,
    isEditingDeal,
    isPoliciesRefreshing,
    isReopeningDeal,
    isRestoringDeal,
    isSchedulingDelay,
    mailboxActionError,
    mailboxActionSuccess,
    setActiveTab,
    setCloseDealReason,
    setEditingTaskId,
    setIsCloseDealPromptOpen,
    setIsCreatingTask,
    setIsEditingDeal,
    handleCheckMailbox,
    handleCloseDealClick,
    handleCloseDealConfirm,
    handleCreateMailbox,
    handleDeleteDealClick,
    handleEditDealClick,
    handleMarkTaskDone,
    handleMergeClick,
    handleRefreshDeal,
    handleReopenDealClick,
    handleRestoreDealClick,
    scheduleNextContact,
    handleSimilarClick,
  } = useDealDetailsPanelActions({
    requestedTab,
    onTabChange,
    selectedDeal,
    relatedTasks,
    isSelectedDealDeleted,
    isDealClosedStatus,
    isCurrentUserSeller,
    canReopenClosedDeal,
    onDeleteDeal,
    onRestoreDeal,
    onCloseDeal,
    onReopenDeal,
    onUpdateTask: async (taskId, data) => onUpdateTask(taskId, data),
    onCreateDealMailbox,
    onCheckDealMailbox,
    onRefreshDeal,
    onRefreshPolicies,
    onScheduleDelay: async (payload) => {
      if (onPostponeDeal) {
        await postponeDealDates(payload);
        return;
      }
      await updateDealDates(payload);
    },
    onLoadChatMessages: async () => undefined,
    onLoadActivityLogs: async () => undefined,
    onLoadDealEvents: () => loadDealEventsRef.current(),
    onReloadNotes: reloadNotes,
    onLoadDriveFiles: loadDriveFiles,
    openMergeModal,
    openSimilarModal,
  });

  const {
    chatMessages,
    isChatLoading,
    chatError,
    activityLogs,
    isActivityLoading,
    activityError,
    dealTimelineEvents,
    isDealEventsLoading,
    dealEventsError,
    loadChatMessages,
    loadActivityLogs,
    loadDealEvents,
    handleChatSendMessage,
    handleChatDelete,
  } = useDealCommunication({
    selectedDealId: selectedDeal?.id,
    selectedDealDeletedAt: selectedDeal?.deletedAt,
    activeTab,
    onFetchChatMessages,
    onSendChatMessage,
    onDeleteChatMessage,
    onFetchDealHistory,
    onFetchDealEvents,
    dealEventsRefreshToken,
  });

  useEffect(() => {
    loadDealEventsRef.current = loadDealEvents;
  }, [loadDealEvents]);

  const {
    isOpen: isFinancialRecordModalOpen,
    paymentId: financialRecordPaymentId,
    defaultRecordType: financialRecordDefaultRecordType,
    editingFinancialRecord,
    editingFinancialRecordId,
    setEditingFinancialRecordId,
    setCreatingFinancialRecordContext,
    closeFinancialRecordModal,
  } = useFinancialRecordModal(financialRecords);

  const {
    isOpen: isPaymentModalOpen,
    editingPaymentId,
    setEditingPaymentId,
    setCreatingPaymentPolicyId,
    editingPayment,
    fixedPolicyId: paymentFixedPolicyId,
    closePaymentModal,
  } = usePaymentModal(payments);

  const timelineDeadlineEvents = useMemo(
    () => buildDealEventsFromTimeline(dealTimelineEvents),
    [dealTimelineEvents],
  );
  const quickEventWindow = useMemo(
    () => buildEventWindow(timelineDeadlineEvents),
    [timelineDeadlineEvents],
  );
  const quickEventDelayEvent = quickEventWindow.upcomingEvents[0] ?? null;
  const quickEventDelayNextContact = useMemo(
    () => calculateNextContactForEvent(quickEventDelayEvent, Math.max(1, delayLeadDays ?? 90)),
    [delayLeadDays, quickEventDelayEvent],
  );
  const quickEventDelayLeadDays = Math.max(1, delayLeadDays ?? 90);
  const quickEventDelayLabel = `за ${quickEventDelayLeadDays} дней до ближайшего события`;
  const quickEventDelayTitle = quickEventDelayEvent
    ? `${quickEventDelayEvent.title}: ${formatDate(quickEventDelayEvent.date)}`
    : 'Нет предстоящих событий';
  const handleQuickEventDelay = useCallback(async () => {
    await scheduleNextContact(quickEventDelayNextContact);
  }, [quickEventDelayNextContact, scheduleNextContact]);

  const handleRefreshDealWithContext = useCallback(async () => {
    await handleRefreshDeal();
    if (activeTab === 'chat') {
      await loadChatMessages();
    }
    if (activeTab === 'history') {
      await loadActivityLogs();
    }
    if (activeTab === 'events') {
      await loadDealEvents();
    }
  }, [activeTab, handleRefreshDeal, loadActivityLogs, loadChatMessages, loadDealEvents]);

  useEffect(() => {
    resetDriveState();
  }, [resetDriveState, selectedDeal?.id]);

  useEffect(() => {
    if (!selectedDeal?.id) {
      return;
    }
    void loadDriveFiles();
  }, [loadDriveFiles, selectedDeal?.id]);

  useEffect(() => {
    if (activeTab === 'files' || activeTab === 'recognition') {
      void loadDriveFiles();
    }
  }, [activeTab, loadDriveFiles]);

  const handleOpenClient = useCallback(
    async (clientId: string) => {
      if (onClientOpenById) {
        await onClientOpenById(clientId);
      } else {
        const client = clients.find((item) => item.id === clientId);
        if (!client) throw new Error('Клиент не найден');
        onClientEdit?.(client);
      }
      navigate('/clients');
    },
    [clients, navigate, onClientEdit, onClientOpenById],
  );

  const quotes = useMemo(
    () => selectedDeal?.quotes.filter((quote) => quote.dealId === selectedDeal.id) ?? [],
    [selectedDeal?.id, selectedDeal?.quotes],
  );
  const tasksCount = useMemo(
    () => relatedTasks.filter((task) => !task.deletedAt).length,
    [relatedTasks],
  );
  const quotesCount = useMemo(() => quotes.filter((quote) => !quote.deletedAt).length, [quotes]);
  const policiesCount = relatedPolicies.length;
  const chatCount = chatMessages.length;
  const filesCount = sortedDriveFiles.length;
  const selectedClientDisplayName = selectedClient?.name || selectedDeal?.clientName || '—';
  const expectedCloseReasons = useMemo(() => {
    return resolveExpectedCloseReason(selectedDeal?.expectedClose, dealTimelineEvents);
  }, [dealTimelineEvents, selectedDeal?.expectedClose]);

  const resetManualEventForm = useCallback(() => {
    setManualEventDate(getTodayInputValue());
    setManualEventReason('');
    setManualEventError(null);
  }, []);

  const handleOpenManualEventModal = useCallback(() => {
    setManualEventError(null);
    setIsManualEventModalOpen(true);
  }, []);

  const handleCloseManualEventModal = useCallback(() => {
    resetManualEventForm();
    setIsManualEventModalOpen(false);
  }, [resetManualEventForm]);

  const refreshAfterDealEventChange = useCallback(async () => {
    if (!selectedDeal?.id) {
      return;
    }
    await Promise.all([loadDealEvents(), onRefreshDeal?.(selectedDeal.id)]);
    if (activeTab === 'history') {
      await loadActivityLogs();
    }
  }, [activeTab, loadActivityLogs, loadDealEvents, onRefreshDeal, selectedDeal?.id]);

  const handleCreateManualDealEvent = useCallback(
    async (data: { eventDate: string; reason: string }) => {
      if (!selectedDeal?.id) {
        throw new Error('Сделка не выбрана');
      }
      await onCreateDealEvent(selectedDeal.id, {
        eventType: 'manual_expected_close',
        ...data,
      });
      await refreshAfterDealEventChange();
    },
    [onCreateDealEvent, refreshAfterDealEventChange, selectedDeal?.id],
  );

  const handleManualEventSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const reason = manualEventReason.trim();
      if (!manualEventDate || !reason) {
        setManualEventError('Укажите дату и причину события.');
        return;
      }

      setManualEventError(null);
      setIsManualEventSaving(true);
      try {
        await handleCreateManualDealEvent({
          eventDate: manualEventDate,
          reason,
        });
        resetManualEventForm();
        setIsManualEventModalOpen(false);
      } catch (err) {
        console.error('Ошибка создания события сделки:', err);
        setManualEventError('Не удалось добавить событие.');
      } finally {
        setIsManualEventSaving(false);
      }
    },
    [handleCreateManualDealEvent, manualEventDate, manualEventReason, resetManualEventForm],
  );

  const handleUpdateManualDealEvent = useCallback(
    async (eventId: string, data: { eventDate?: string; reason?: string }) => {
      if (!selectedDeal?.id) {
        throw new Error('Сделка не выбрана');
      }
      await onUpdateDealEvent(selectedDeal.id, eventId, data);
      await refreshAfterDealEventChange();
    },
    [onUpdateDealEvent, refreshAfterDealEventChange, selectedDeal?.id],
  );

  const handleDeleteManualDealEvent = useCallback(
    async (eventId: string) => {
      if (!selectedDeal?.id) {
        throw new Error('Сделка не выбрана');
      }
      await onDeleteDealEvent(selectedDeal.id, eventId);
      await refreshAfterDealEventChange();
    },
    [onDeleteDealEvent, refreshAfterDealEventChange, selectedDeal?.id],
  );

  return {
    ConfirmDialogRenderer,
    accessMessage,
    actionError,
    activeTab,
    activityError,
    activityLogs,
    attachNoteFile,
    canRecognizeSelectedFiles,
    canReopenClosedDeal,
    chatCount,
    chatError,
    chatMessages,
    clientDuplicateHint,
    clients,
    closeDealReason,
    closeDealReasonError,
    closeFinancialRecordModal,
    closeMergeModal,
    closePaymentModal,
    closeSimilarModal,
    completingTaskIds,
    continueFromSimilarToMerge,
    currentUser,
    dealEventsError,
    dealRefreshError,
    dealTimelineEvents,
    deals,
    delayLeadDaysLoading,
    displayedTasks,
    downloadMessage,
    driveError,
    driveSortDirection,
    editingFinancialRecord,
    editingFinancialRecordId,
    editingPayment,
    editingPaymentId,
    editingTask,
    editingTaskId,
    executorDisplayName,
    expandedFolderIds,
    expectedCloseInputValue,
    expectedCloseReasons,
    filesCount,
    financialRecordDefaultRecordType,
    financialRecordPaymentId,
    getDriveFileBlob,
    getDriveFileDepth,
    handleAddNote,
    handleArchiveNote,
    handleChatDelete,
    handleChatSendMessage,
    handleCheckMailbox,
    handleCloseDealClick,
    handleCloseDealConfirm,
    handleCloseManualEventModal,
    handleCreateMailbox,
    handleDeleteDealClick,
    handleDeleteManualDealEvent,
    handleDownloadDriveFiles,
    handleDriveFileUpload,
    handleEditDealClick,
    handleManualEventSubmit,
    handleMarkTaskDone,
    handleMergeClick,
    handleMergeSubmit,
    handleNextContactBlur,
    handleNextContactChange,
    handleOpenClient,
    handleOpenManualEventModal,
    handleQuickEventDelay,
    handleQuickNextContactShift,
    handleRecognizePolicies,
    handleRefreshDealWithContext,
    handleRenameDriveFile,
    handleMoveDriveFiles,
    handleReopenDealClick,
    handleRestoreDealClick,
    handleRestoreNote,
    handleSimilarClick,
    handleTrashDriveFile,
    handleTrashSelectedFiles,
    handleUpdateManualDealEvent,
    handleUploadAndRecognizePolicyFiles,
    headerExpectedCloseTone,
    isActivityLoading,
    isChatLoading,
    isCheckingMailbox,
    isCloseDealPromptOpen,
    isClosingDeal,
    isCreatingMailbox,
    isCreatingTask,
    isCurrentUserSeller,
    isDealClosedStatus,
    isDealEventsLoading,
    isDealRefreshing,
    isDeletingDeal,
    isDownloading,
    isDriveLoading,
    isEditingDeal,
    isFinancialRecordModalOpen,
    isFolderLoading,
    isManualEventModalOpen,
    isManualEventSaving,
    isMergeModalOpen,
    isMergePreviewConfirmed,
    isMergePreviewLoading,
    isMergeSearchActive,
    isMergeSearchLoading,
    isMerging,
    isMoving,
    isPaymentModalOpen,
    isPoliciesRefreshing,
    isQuotesLoading,
    isRecognizing,
    isRenaming,
    isReopeningDeal,
    isRestoringDeal,
    isSchedulingDelay,
    isSelectedDealDeleted,
    isSimilarLoading,
    isSimilarModalOpen,
    isTasksLoading,
    isTrashing,
    loadChatMessages,
    loadDriveFiles,
    mailboxActionError,
    mailboxActionSuccess,
    manualEventDate,
    manualEventError,
    manualEventReason,
    mergeError,
    mergeFinalDraft,
    mergeList,
    mergePreviewWarnings,
    mergeQuery,
    mergeSearch,
    mergeSources,
    mergeStep,
    moveMessage,
    nextContactInputValue,
    noteAttachments,
    noteAttachmentsUploading,
    noteDraft,
    noteIsImportant,
    notes,
    notesAction,
    notesError,
    notesFilter,
    notesLoading,
    onAddFinancialRecord,
    onAddPayment,
    onClearAccessMessage,
    onClearDealFocus,
    onClientEdit,
    onClientFindSimilar,
    onClientNormalizeName,
    onCreateTask,
    onDeleteFinancialRecord,
    onDeletePayment,
    onDeletePolicy,
    onDeleteQuote,
    onDeleteTask,
    onMarkFinancialRecordPaid,
    onMarkPaymentPaid,
    onMovePolicy,
    onPendingDealClientConsumed,
    onPostponeDeal,
    onRefreshDeal,
    onRequestAddClient,
    onRequestAddPolicy,
    onRequestAddQuote,
    onRequestEditPolicy,
    onRequestEditQuote,
    onSelectDeal,
    onUpdateDeal,
    onUpdateFinancialRecord,
    onUpdatePayment,
    onUpdatePolicyRenewed,
    onUpdateTask,
    paymentFixedPolicyId,
    pendingDealClient,
    policiesCount,
    policySortKey,
    policySortOrder,
    quickEventDelayEvent,
    quickEventDelayLabel,
    quickEventDelayNextContact,
    quickEventDelayTitle,
    quickInlineDateOptions,
    quickInlinePostponeShift,
    quickInlineShift,
    quotes,
    quotesCount,
    recognitionMessage,
    recognitionResults,
    relatedPayments,
    relatedPolicies,
    relatedTasks,
    removeNoteAttachment,
    renameMessage,
    requestMergePreview,
    selectedClient,
    selectedClientDisplayName,
    selectedDeal,
    selectedDriveFileIds,
    selectedSimilarIds,
    sellerDisplayName,
    setActiveTab,
    setCloseDealReason,
    setCreatingFinancialRecordContext,
    setCreatingPaymentPolicyId,
    setEditingFinancialRecordId,
    setEditingPaymentId,
    setEditingTaskId,
    setIsCloseDealPromptOpen,
    setIsCreatingTask,
    setIsEditingDeal,
    setManualEventDate,
    setManualEventReason,
    setMergeSearch,
    setMergeStep,
    setNoteDraft,
    setNoteIsImportant,
    setNotesFilter,
    setPolicySortKey,
    setPolicySortOrder,
    setSimilarIncludeClosed,
    similarCandidates,
    similarError,
    similarIncludeClosed,
    sortedDriveFiles,
    sortedPolicies,
    tasksCount,
    toggleDriveFileSelection,
    toggleDriveSortDirection,
    toggleFolderExpanded,
    toggleMergeSource,
    toggleSimilarCandidate,
    trashMessage,
    users,
  };
}
