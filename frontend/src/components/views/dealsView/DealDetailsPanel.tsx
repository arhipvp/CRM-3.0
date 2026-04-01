import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ActivityLog,
  ChatMessage,
  Client,
  Deal,
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
import { calculateNextContactForEvent, resolveSelectedDelayEvent } from './eventDelay';
import type { DealEvent } from './eventUtils';
import { buildDealEvents, buildEventWindow } from './eventUtils';
import {
  DealTabId,
  PolicySortKey,
  closedDealStatuses,
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
  policies: Policy[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  tasks: Task[];
  users: User[];
  currentUser: User | null;
  sortedDeals: Deal[];
  selectedDeal: Deal | null;
  selectedClient: Client | null;
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
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
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
  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
  onRestoreDeal: (dealId: string) => Promise<void>;
  onDealSelectionBlockedChange?: (blocked: boolean) => void;
  onClearDealFocus?: () => void;
  onRefreshDeal?: (dealId: string) => Promise<void>;
  isTasksLoading?: boolean;
  isQuotesLoading?: boolean;
}

export const DealDetailsPanel: React.FC<DealDetailsPanelProps> = ({
  deals,
  clients,
  onClientEdit,
  policies,
  payments,
  financialRecords,
  tasks,
  users,
  currentUser,
  sortedDeals,
  selectedDeal,
  selectedClient,
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
  onRefreshPolicies,
  onPolicyDraftReady,
  onAddPayment,
  onUpdatePayment,
  onDeletePayment,
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
  onDriveFolderCreated,
  onCreateDealMailbox,
  onCheckDealMailbox,
  onFetchChatMessages,
  onSendChatMessage,
  onDeleteChatMessage,
  onFetchDealHistory,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteDeal,
  onRestoreDeal,
  onDealSelectionBlockedChange,
  onClearDealFocus,
  onRefreshDeal,
  isTasksLoading = false,
  isQuotesLoading = false,
}) => {
  const navigate = useNavigate();
  const { confirm, ConfirmDialogRenderer } = useConfirm();
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
    onConfirmDeleteFile: async (name) => confirm(confirmTexts.deleteDriveFile(name)),
    onRefreshPolicies,
    onRefreshNotes: reloadNotes,
    onPolicyDraftReady,
  });

  const {
    nextContactInputValue,
    expectedCloseInputValue,
    handleNextContactChange,
    handleExpectedCloseChange,
    handleNextContactBlur,
    handleExpectedCloseBlur,
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

  const dealEvents = useMemo<DealEvent[]>(() => {
    if (!selectedDeal) {
      return [];
    }
    return buildDealEvents({
      policies: relatedPolicies,
      payments: relatedPayments,
    });
  }, [relatedPolicies, relatedPayments, selectedDeal]);

  const eventWindow = useMemo(() => buildEventWindow(dealEvents), [dealEvents]);
  const { upcomingEvents, pastEvents } = eventWindow;

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
    delayNextContactInput,
    delayValidationError,
    editingTask,
    editingTaskId,
    isCheckingMailbox,
    isCloseDealPromptOpen,
    isClosingDeal,
    isCreatingMailbox,
    isCreatingTask,
    isDealRefreshing,
    isDeletingDeal,
    isDelayModalOpen,
    isEditingDeal,
    isPoliciesRefreshing,
    isReopeningDeal,
    isRestoringDeal,
    isSchedulingDelay,
    mailboxActionError,
    mailboxActionSuccess,
    selectedDelayEventId,
    setActiveTab,
    setCloseDealReason,
    setEditingTaskId,
    setIsCloseDealPromptOpen,
    setIsCreatingTask,
    setIsDelayModalOpen,
    setIsEditingDeal,
    setDelayNextContactInput,
    setSelectedDelayEventId,
    handleCheckMailbox,
    handleCloseDealClick,
    handleCloseDealConfirm,
    handleCreateMailbox,
    handleDeleteDealClick,
    handleDelayModalConfirm,
    handleEditDealClick,
    handleMarkTaskDone,
    handleMergeClick,
    handleRefreshDeal,
    handleReopenDealClick,
    handleRestoreDealClick,
    handleSimilarClick,
  } = useDealDetailsPanelActions({
    selectedDeal,
    relatedTasks,
    dealEvents,
    nextDelayEventId: eventWindow.nextEvent?.id ?? null,
    selectedDelayEvent: resolveSelectedDelayEvent(
      dealEvents,
      null,
      eventWindow.nextEvent?.id ?? null,
    ),
    selectedDelayEventNextContact: null,
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
    loadChatMessages,
    loadActivityLogs,
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
  });

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

  const selectedDelayEvent = useMemo(
    () =>
      resolveSelectedDelayEvent(
        dealEvents,
        selectedDelayEventId,
        eventWindow.nextEvent?.id ?? null,
      ),
    [dealEvents, eventWindow.nextEvent?.id, selectedDelayEventId],
  );

  const selectedDelayEventNextContact = useMemo(
    () => calculateNextContactForEvent(selectedDelayEvent, Math.max(1, delayLeadDays ?? 90)),
    [delayLeadDays, selectedDelayEvent],
  );

  const handleRefreshDealWithContext = useCallback(async () => {
    await handleRefreshDeal();
    if (activeTab === 'chat') {
      await loadChatMessages();
    }
    if (activeTab === 'history') {
      await loadActivityLogs();
    }
  }, [activeTab, handleRefreshDeal, loadActivityLogs, loadChatMessages]);

  useEffect(() => {
    if (isDelayModalOpen) {
      setDelayNextContactInput(selectedDelayEventNextContact);
    }
  }, [isDelayModalOpen, selectedDelayEventNextContact, setDelayNextContactInput]);

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

  const quotes = useMemo(() => selectedDeal?.quotes ?? [], [selectedDeal?.quotes]);
  const tasksCount = useMemo(
    () => relatedTasks.filter((task) => !task.deletedAt).length,
    [relatedTasks],
  );
  const quotesCount = useMemo(() => quotes.filter((quote) => !quote.deletedAt).length, [quotes]);
  const policiesCount = relatedPolicies.length;
  const chatCount = chatMessages.length;
  const filesCount = sortedDriveFiles.length;
  const selectedClientDisplayName = selectedClient?.name || selectedDeal?.clientName || '—';

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
                clientPhone={selectedClient?.phone}
                sellerDisplayName={sellerDisplayName}
                executorDisplayName={executorDisplayName}
                myTrackedTimeLabel={myTotalLabel}
                onClientEdit={onClientEdit}
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
                dealEventsLength={dealEvents.length}
                onEdit={handleEditDealClick}
                onRestore={handleRestoreDealClick}
                onDelete={handleDeleteDealClick}
                onClose={handleCloseDealClick}
                onReopen={handleReopenDealClick}
                onMerge={handleMergeClick}
                onSimilar={handleSimilarClick}
                onDelay={() => setIsDelayModalOpen(true)}
                onRefresh={handleRefreshDealWithContext}
                isRefreshing={isDealRefreshing}
              />
            </div>
            {actionError && <InlineAlert>{actionError}</InlineAlert>}
            {dealRefreshError && <InlineAlert>{dealRefreshError}</InlineAlert>}
            <DealDateControls
              nextContactValue={nextContactInputValue}
              expectedCloseValue={expectedCloseInputValue}
              headerExpectedCloseTone={headerExpectedCloseTone}
              quickOptions={quickInlineDateOptions}
              onNextContactChange={handleNextContactChange}
              onNextContactBlur={handleNextContactBlur}
              onExpectedCloseChange={handleExpectedCloseChange}
              onExpectedCloseBlur={handleExpectedCloseBlur}
              onQuickShift={onPostponeDeal ? quickInlinePostponeShift : quickInlineShift}
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
                }}
                loadingByTab={{
                  tasks: isTasksLoading,
                  quotes: isQuotesLoading,
                  policies: isPoliciesRefreshing,
                  chat: isChatLoading,
                  files: isDriveLoading,
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
                    sortedPolicies,
                    policySortKey,
                    policySortOrder,
                    setPolicySortKey,
                    setPolicySortOrder,
                    onRequestAddPolicy,
                    onDeletePolicy,
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
                    onDealSelect: onSelectDeal,
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
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-sm text-slate-600">
            Выберите сделку, чтобы увидеть подробности.
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
        isDelayModalOpen={isDelayModalOpen}
        setIsDelayModalOpen={setIsDelayModalOpen}
        selectedDelayEvent={selectedDelayEvent}
        selectedEventNextContact={selectedDelayEventNextContact}
        nextContactValue={delayNextContactInput}
        upcomingEvents={upcomingEvents}
        pastEvents={pastEvents}
        isSchedulingDelay={isSchedulingDelay}
        isLeadDaysLoading={delayLeadDaysLoading}
        validationError={delayValidationError}
        onEventSelect={(value) => value && setSelectedDelayEventId(value)}
        onNextContactChange={(value) => value && setDelayNextContactInput(value)}
        onConfirmDelay={handleDelayModalConfirm}
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
