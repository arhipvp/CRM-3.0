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
} from '../../../types';
import type { DealMailboxCreateResult, DealMailboxSyncResult } from '../../../api/deals';
import type { AddFinancialRecordFormValues } from '../../forms/AddFinancialRecordForm';
import type { AddPaymentFormValues } from '../../forms/AddPaymentForm';
import type { AddTaskFormValues } from '../../forms/AddTaskForm';
import type { DealFormValues } from '../../forms/DealForm';
import { BTN_PRIMARY } from '../../common/buttonStyles';
import { FormActions } from '../../common/forms/FormActions';
import { FormField } from '../../common/forms/FormField';
import { InlineAlert } from '../../common/InlineAlert';
import { FormModal } from '../../common/modal/FormModal';
import { useConfirm } from '../../../hooks/useConfirm';
import { useFinancialRecordModal } from '../../../hooks/useFinancialRecordModal';
import { usePaymentModal } from '../../../hooks/usePaymentModal';
import { confirmTexts } from '../../../constants/confirmTexts';
import { DealActions } from './DealActions';
import { DealDateControls } from './DealDateControls';
import { DealDetailsPanelModals } from './DealDetailsPanelModals';
import { DealDetailsPanelTabContent } from './DealDetailsPanelTabContent';
import { DealHeader } from './DealHeader';
import { DealTabs } from './DealTabs';
import { calculateNextContactForEvent } from './eventDelay';
import { buildDealEventsFromTimeline, buildEventWindow } from './eventUtils';
import { resolveExpectedCloseReason } from './expectedCloseReason';
import {
  DealTabId,
  PolicySortKey,
  closedDealStatuses,
  formatDate,
  getDeadlineTone,
  getPolicySortValue,
  getUserDisplayName,
} from './helpers';
import { useDealDetailsPanelActions } from './hooks/useDealDetailsPanelActions';
import { useDealCommunication } from './hooks/useDealCommunication';
import { useDealDriveFiles } from './hooks/useDealDriveFiles';
import { useDealInlineDates } from './hooks/useDealInlineDates';
import { useDealMerge } from './hooks/useDealMerge';
import { useDealNotes } from './hooks/useDealNotes';
import { useDealTimeTracking } from './hooks/useDealTimeTracking';

export interface DealDetailsPanelProps {
  deals: Deal[];
  clients: Client[];
  onClientEdit?: (client: Client) => void;
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
  pendingDealClientId?: string | null;
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
  onFetchChatMessages: (dealId: string) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<ChatMessage>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (dealId: string, includeDeleted?: boolean) => Promise<ActivityLog[]>;
  onFetchDealEvents: (dealId: string, includeDeleted?: boolean) => Promise<DealTimelineEvent[]>;
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
  onDealSelectionBlockedChange?: (blocked: boolean) => void;
  onClearDealFocus?: () => void;
  accessMessage?: string | null;
  onClearAccessMessage?: () => void;
  onRefreshDeal?: (dealId: string) => Promise<void>;
  isTasksLoading?: boolean;
  isQuotesLoading?: boolean;
}

const getTodayInputValue = () => new Date().toISOString().slice(0, 10);

export const DealDetailsPanel: React.FC<DealDetailsPanelProps> = ({
  deals,
  clients,
  onClientEdit,
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
  pendingDealClientId,
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
  onDealSelectionBlockedChange,
  onClearDealFocus,
  accessMessage,
  onClearAccessMessage,
  onRefreshDeal,
  isTasksLoading = false,
  isQuotesLoading = false,
}) => {
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
    myTotalLabel,
    isConfirmModalOpen: isTimeTrackingConfirmModalOpen,
    continueTracking,
  } = useDealTimeTracking(selectedDeal?.id);

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
    onDealSelectionBlockedChange?.(isTimeTrackingConfirmModalOpen);
    return () => onDealSelectionBlockedChange?.(false);
  }, [isTimeTrackingConfirmModalOpen, onDealSelectionBlockedChange]);

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
    if (activeTab === 'files') {
      void loadDriveFiles();
    }
  }, [activeTab, loadDriveFiles]);

  const handleOpenClient = useCallback(
    (client: Client) => {
      onClientEdit?.(client);
      navigate('/clients');
    },
    [navigate, onClientEdit],
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

  const handleCreateManualDealEvent = useCallback(
    async (data: { eventDate: string; reason: string }) => {
      if (!selectedDeal?.id) {
        throw new Error('Сделка не выбрана');
      }
      await onCreateDealEvent(selectedDeal.id, {
        eventType: 'manual_expected_close',
        ...data,
      });
      await loadDealEvents();
      await handleRefreshDealWithContext();
    },
    [handleRefreshDealWithContext, loadDealEvents, onCreateDealEvent, selectedDeal?.id],
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
      await loadDealEvents();
      await handleRefreshDealWithContext();
    },
    [handleRefreshDealWithContext, loadDealEvents, onUpdateDealEvent, selectedDeal?.id],
  );

  const handleDeleteManualDealEvent = useCallback(
    async (eventId: string) => {
      if (!selectedDeal?.id) {
        throw new Error('Сделка не выбрана');
      }
      await onDeleteDealEvent(selectedDeal.id, eventId);
      await loadDealEvents();
      await handleRefreshDealWithContext();
    },
    [handleRefreshDealWithContext, loadDealEvents, onDeleteDealEvent, selectedDeal?.id],
  );

  return (
    <>
      <div className="space-y-4 px-4 py-5">
        {selectedDeal ? (
          <div
            className={`relative space-y-6 rounded-3xl border bg-white p-6 shadow-[0_18px_40px_rgba(15,23,42,0.09)] ${
              selectedDeal.isPinned
                ? 'border-rose-500 ring-2 ring-rose-500/30'
                : 'border-blue-500 ring-2 ring-blue-400/30'
            }`}
          >
            <button
              type="button"
              onClick={onClearDealFocus}
              className="icon-btn absolute right-3 top-3 z-10 h-8 w-8"
              aria-label="Снять фокус со сделки"
              title="Снять фокус со сделки"
            >
              ✕
            </button>
            <div className="flex flex-col gap-4">
              <DealHeader
                deal={selectedDeal}
                clientDisplayName={selectedClientDisplayName}
                client={selectedClient}
                clientDuplicateHint={clientDuplicateHint}
                clientPhone={selectedClient?.phone}
                sellerDisplayName={sellerDisplayName}
                executorDisplayName={executorDisplayName}
                myTrackedTimeLabel={myTotalLabel}
                onClientEdit={onClientEdit}
                onClientFindSimilar={onClientFindSimilar}
                onClientNormalizeName={onClientNormalizeName}
              />
              <DealActions
                isSelectedDealDeleted={isSelectedDealDeleted}
                isDeletingDeal={isDeletingDeal}
                isRestoringDeal={isRestoringDeal}
                isDealClosedStatus={isDealClosedStatus}
                isClosingDeal={isClosingDeal}
                isReopeningDeal={isReopeningDeal}
                isCurrentUserSeller={isCurrentUserSeller}
                canReopenClosedDeal={canReopenClosedDeal}
                onEdit={handleEditDealClick}
                onRestore={handleRestoreDealClick}
                onDelete={handleDeleteDealClick}
                onClose={handleCloseDealClick}
                onReopen={handleReopenDealClick}
                onMerge={handleMergeClick}
                onSimilar={handleSimilarClick}
                onRefresh={handleRefreshDealWithContext}
                isRefreshing={isDealRefreshing}
              />
            </div>
            {actionError && <InlineAlert>{actionError}</InlineAlert>}
            {dealRefreshError && <InlineAlert>{dealRefreshError}</InlineAlert>}
            <DealDateControls
              nextContactValue={nextContactInputValue}
              expectedCloseValue={formatDate(expectedCloseInputValue)}
              headerExpectedCloseTone={headerExpectedCloseTone}
              quickOptions={quickInlineDateOptions}
              eventDelayLabel={quickEventDelayLabel}
              eventDelayDisabled={
                !quickEventDelayEvent ||
                !quickEventDelayNextContact ||
                delayLeadDaysLoading ||
                isSchedulingDelay
              }
              eventDelayTitle={quickEventDelayTitle}
              onNextContactChange={handleNextContactChange}
              onNextContactBlur={handleNextContactBlur}
              onQuickShift={onPostponeDeal ? quickInlinePostponeShift : quickInlineShift}
              onEventDelayClick={() => void handleQuickEventDelay()}
              onAddEventClick={handleOpenManualEventModal}
              expectedCloseReason={expectedCloseReasons}
              isExpectedCloseReasonsLoading={isDealEventsLoading}
            />
            <div>
              <DealTabs
                activeTab={activeTab}
                onChange={(value) => setActiveTab(value as DealTabId)}
                tabCounts={{
                  tasks: tasksCount,
                  quotes: quotesCount,
                  policies: policiesCount,
                  chat: chatCount,
                  files: filesCount,
                  events: dealTimelineEvents.length,
                  history: activityLogs.length,
                }}
                loadingByTab={{
                  tasks: isTasksLoading,
                  quotes: isQuotesLoading,
                  policies: isPoliciesRefreshing,
                  chat: isChatLoading,
                  files: isDriveLoading,
                  events: isDealEventsLoading,
                  history: isActivityLoading,
                }}
              />
              <div
                className="border-t border-slate-100 pt-6"
                role="tabpanel"
                id={`deal-tabpanel-${activeTab}`}
                aria-labelledby={`deal-tab-${activeTab}`}
                tabIndex={0}
              >
                <DealDetailsPanelTabContent
                  activeTab={activeTab}
                  notesSectionProps={{
                    dealId: selectedDeal?.id,
                    notes,
                    notesLoading,
                    notesFilter,
                    noteDraft,
                    noteIsImportant,
                    notesError,
                    notesAction,
                    noteAttachments,
                    noteAttachmentsUploading,
                    onSetFilter: setNotesFilter,
                    onSetDraft: setNoteDraft,
                    onToggleImportant: setNoteIsImportant,
                    onAddNote: handleAddNote,
                    onAttachNoteFile: attachNoteFile,
                    onRemoveNoteAttachment: removeNoteAttachment,
                    onArchiveNote: handleArchiveNote,
                    onRestoreNote: handleRestoreNote,
                  }}
                  tasksTabProps={{
                    selectedDeal,
                    displayedTasks,
                    relatedTasks,
                    onCreateTaskClick: () => setIsCreatingTask(true),
                    onEditTaskClick: setEditingTaskId,
                    onMarkTaskDone: handleMarkTaskDone,
                    onDeleteTask,
                    completingTaskIds,
                  }}
                  policiesTabProps={{
                    selectedDeal,
                    deals,
                    sortedPolicies,
                    policySortKey,
                    policySortOrder,
                    setPolicySortKey,
                    setPolicySortOrder,
                    onRequestAddPolicy,
                    onDeletePolicy,
                    onMovePolicy,
                    onUpdatePolicyRenewed,
                    onRequestEditPolicy,
                    relatedPayments,
                    clients,
                    onOpenClient: handleOpenClient,
                    setEditingPaymentId,
                    setCreatingPaymentPolicyId,
                    setCreatingFinancialRecordContext,
                    setEditingFinancialRecordId,
                    onDeleteFinancialRecord,
                    onDeletePayment,
                    onMarkPaymentPaid,
                    onMarkFinancialRecordPaid,
                    onDealSelect: onSelectDeal,
                    onUploadAndRecognizePolicyFiles: handleUploadAndRecognizePolicyFiles,
                    policyRecognitionMessage: recognitionMessage,
                    isRecognizingPolicyFiles: isRecognizing,
                    isLoading: isPoliciesRefreshing,
                  }}
                  quotesTabProps={{
                    selectedDeal,
                    quotes,
                    onRequestAddQuote,
                    onRequestEditQuote,
                    onDeleteQuote,
                  }}
                  filesTabProps={{
                    selectedDeal,
                    isDriveLoading,
                    loadDriveFiles,
                    onUploadDriveFile: handleDriveFileUpload,
                    isSelectedDealDeleted,
                    selectedDriveFileIds,
                    toggleDriveFileSelection,
                    handleRecognizePolicies,
                    isRecognizing,
                    recognitionResults,
                    recognitionMessage,
                    isTrashing,
                    trashMessage,
                    handleTrashSelectedFiles,
                    handleTrashDriveFile,
                    isDownloading,
                    downloadMessage,
                    handleDownloadDriveFiles,
                    getDriveFileBlob,
                    driveError,
                    sortedDriveFiles,
                    expandedFolderIds,
                    toggleFolderExpanded,
                    isFolderLoading,
                    getDriveFileDepth,
                    canRecognizeSelectedFiles,
                    driveSortDirection,
                    toggleDriveSortDirection,
                    isRenaming,
                    renameMessage,
                    handleRenameDriveFile,
                    isCreatingMailbox,
                    isCheckingMailbox,
                    mailboxActionError,
                    mailboxActionSuccess,
                    onCreateMailbox: handleCreateMailbox,
                    onCheckMailbox: handleCheckMailbox,
                  }}
                  chatTabProps={{
                    selectedDeal,
                    chatMessages,
                    isChatLoading,
                    currentUser,
                    onSendMessage: handleChatSendMessage,
                    onDeleteMessage: handleChatDelete,
                  }}
                  activityProps={{
                    activityError,
                    activityLogs,
                    isActivityLoading,
                    dealEventsError,
                    dealTimelineEvents,
                    isDealEventsLoading,
                    onUpdateManualEvent: handleUpdateManualDealEvent,
                    onDeleteManualEvent: handleDeleteManualDealEvent,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div
            className={`rounded-3xl border border-dashed p-6 text-sm ${
              accessMessage
                ? 'border-rose-300 bg-rose-50/80 text-rose-800'
                : 'border-slate-300 bg-slate-50/80 text-slate-600'
            }`}
            role={accessMessage ? 'alert' : 'status'}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-base font-semibold text-slate-900">
                  {accessMessage ? 'Сделка недоступна' : 'Выберите сделку'}
                </p>
                <p>
                  {accessMessage ??
                    'Откройте сделку из списка, чтобы увидеть контакты, задачи, полисы и историю.'}
                </p>
              </div>
              {accessMessage && onClearAccessMessage && (
                <button
                  type="button"
                  onClick={onClearAccessMessage}
                  className="btn btn-sm btn-quiet"
                >
                  Понятно
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <DealDetailsPanelModals
        clients={clients}
        users={users}
        selectedDeal={selectedDeal}
        relatedPolicies={relatedPolicies}
        selectedClientDisplayName={selectedClientDisplayName}
        pendingDealClientId={pendingDealClientId}
        onPendingDealClientConsumed={onPendingDealClientConsumed}
        onRequestAddClient={onRequestAddClient}
        onUpdateDeal={onUpdateDeal}
        onCreateTask={onCreateTask}
        onUpdateTask={onUpdateTask}
        onAddPayment={onAddPayment}
        onUpdatePayment={onUpdatePayment}
        onAddFinancialRecord={onAddFinancialRecord}
        onUpdateFinancialRecord={onUpdateFinancialRecord}
        isEditingDeal={isEditingDeal}
        setIsEditingDeal={setIsEditingDeal}
        isCreatingTask={isCreatingTask}
        setIsCreatingTask={setIsCreatingTask}
        editingTaskId={editingTaskId}
        editingTask={editingTask}
        setEditingTaskId={setEditingTaskId}
        isPaymentModalOpen={isPaymentModalOpen}
        editingPaymentId={editingPaymentId}
        editingPayment={editingPayment}
        paymentFixedPolicyId={paymentFixedPolicyId}
        closePaymentModal={closePaymentModal}
        isFinancialRecordModalOpen={isFinancialRecordModalOpen}
        editingFinancialRecordId={editingFinancialRecordId}
        editingFinancialRecord={editingFinancialRecord}
        financialRecordPaymentId={financialRecordPaymentId}
        financialRecordDefaultRecordType={financialRecordDefaultRecordType}
        closeFinancialRecordModal={closeFinancialRecordModal}
        isMergeModalOpen={isMergeModalOpen}
        mergeSearch={mergeSearch}
        setMergeSearch={setMergeSearch}
        mergeList={mergeList}
        mergeSources={mergeSources}
        toggleMergeSource={toggleMergeSource}
        mergeError={mergeError}
        mergePreviewWarnings={mergePreviewWarnings}
        mergeStep={mergeStep}
        setMergeStep={setMergeStep}
        mergeFinalDraft={mergeFinalDraft}
        requestMergePreview={requestMergePreview}
        isMergePreviewLoading={isMergePreviewLoading}
        isMergePreviewConfirmed={isMergePreviewConfirmed}
        isMergeSearchLoading={isMergeSearchLoading}
        isMergeSearchActive={isMergeSearchActive}
        mergeQuery={mergeQuery}
        isMerging={isMerging}
        closeMergeModal={closeMergeModal}
        handleMergeSubmit={handleMergeSubmit}
        isSimilarModalOpen={isSimilarModalOpen}
        similarCandidates={similarCandidates}
        selectedSimilarIds={selectedSimilarIds}
        similarIncludeClosed={similarIncludeClosed}
        isSimilarLoading={isSimilarLoading}
        similarError={similarError}
        setSimilarIncludeClosed={setSimilarIncludeClosed}
        toggleSimilarCandidate={toggleSimilarCandidate}
        continueFromSimilarToMerge={continueFromSimilarToMerge}
        closeSimilarModal={closeSimilarModal}
        isCloseDealPromptOpen={isCloseDealPromptOpen}
        setIsCloseDealPromptOpen={setIsCloseDealPromptOpen}
        closeDealReason={closeDealReason}
        setCloseDealReason={setCloseDealReason}
        closeDealReasonError={closeDealReasonError}
        handleCloseDealConfirm={handleCloseDealConfirm}
        isClosingDeal={isClosingDeal}
        quickInlineDateOptions={quickInlineDateOptions}
        handleQuickNextContactShift={handleQuickNextContactShift}
      />
      <FormModal
        isOpen={isManualEventModalOpen}
        title="Добавить событие"
        onClose={handleCloseManualEventModal}
        size="sm"
      >
        <form className="space-y-4" onSubmit={handleManualEventSubmit}>
          {manualEventError && <InlineAlert>{manualEventError}</InlineAlert>}
          <FormField label="Дата" htmlFor="deal-manual-event-date">
            <input
              id="deal-manual-event-date"
              type="date"
              className="field field-input w-full"
              value={manualEventDate}
              onChange={(event) => setManualEventDate(event.target.value)}
            />
          </FormField>
          <FormField label="Причина" htmlFor="deal-manual-event-reason">
            <input
              id="deal-manual-event-reason"
              type="text"
              className="field field-input w-full"
              value={manualEventReason}
              onChange={(event) => setManualEventReason(event.target.value)}
              placeholder="Например: предположительно купит квартиру, предложить застраховать"
            />
          </FormField>
          <FormActions
            onCancel={handleCloseManualEventModal}
            submitLabel="Добавить"
            submittingLabel="Добавляем..."
            isSubmitting={isManualEventSaving}
          />
        </form>
      </FormModal>
      <ConfirmDialogRenderer />
      <FormModal
        isOpen={isTimeTrackingConfirmModalOpen}
        title="Продолжить учет времени по сделке?"
        onClose={() => undefined}
        size="sm"
        closeOnOverlayClick={false}
        closeOnEscape={false}
        hideCloseButton
        zIndex={80}
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-700">
            Учет времени приостановлен. Чтобы продолжить работу со сделкой, подтвердите продолжение
            учета времени.
          </p>
          <button type="button" onClick={continueTracking} className={`${BTN_PRIMARY} w-full`}>
            Продолжить
          </button>
        </div>
      </FormModal>
    </>
  );
};
