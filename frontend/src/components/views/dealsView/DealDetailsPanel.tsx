import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useDealInlineDates } from './hooks/useDealInlineDates';
import { useDealMerge } from './hooks/useDealMerge';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../common/buttonStyles';

import { ActivityTimeline } from '../../ActivityTimeline';
import { DealForm, DealFormValues } from '../../forms/DealForm';
import { AddTaskForm, AddTaskFormValues } from '../../forms/AddTaskForm';
import type { AddPaymentFormValues } from '../../forms/AddPaymentForm';
import { AddFinancialRecordFormValues } from '../../forms/AddFinancialRecordForm';
import {
  DealTabId,
  getDeadlineTone,
  getPolicySortValue,
  getUserDisplayName,
  PolicySortKey,
  closedDealStatuses,
} from './helpers';

import type { DealEvent } from './eventUtils';
import { buildDealEvents, buildEventWindow } from './eventUtils';
import { calculateNextContactForEvent, resolveSelectedDelayEvent } from './eventDelay';
import { TasksTab } from './tabs/TasksTab';
import { PoliciesTab } from './tabs/PoliciesTab';
import { QuotesTab } from './tabs/QuotesTab';
import { FilesTab } from './tabs/FilesTab';
import { ChatTab } from './tabs/ChatTab';
import { Modal } from '../../Modal';
import { DealDelayModal, DealMergeModal } from './DealDetailsModals';
import { DealTabs } from './DealTabs';
import { DealHeader } from './DealHeader';
import { DealActions } from './DealActions';
import { DealNotesSection } from './DealNotesSection';
import { DealDateControls } from './DealDateControls';
import { useDealNotes } from './hooks/useDealNotes';
import { useDealDriveFiles } from './hooks/useDealDriveFiles';
import { useDealCommunication } from './hooks/useDealCommunication';
import { FinancialRecordModal } from '../../financialRecords/FinancialRecordModal';
import { InlineAlert } from '../../common/InlineAlert';
import { PromptDialog } from '../../common/modal/PromptDialog';
import { FormModal } from '../../common/modal/FormModal';
import { useFinancialRecordModal } from '../../../hooks/useFinancialRecordModal';
import { PaymentModal } from '../../payments/PaymentModal';
import { usePaymentModal } from '../../../hooks/usePaymentModal';
import { fetchNotificationSettings } from '../../../api/notifications';
import { useConfirm } from '../../../hooks/useConfirm';
import { confirmTexts } from '../../../constants/confirmTexts';
import { useDealTimeTracking } from './hooks/useDealTimeTracking';

interface DealDetailsPanelProps {
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
    resultingClientId?: string,
  ) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
  onRequestEditQuote: (quote: Quote) => void;
  onRequestAddPolicy: (dealId: string) => void;
  onRequestEditPolicy: (policy: Policy) => void;
  onRequestAddClient: () => void;
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
    toggleMergeSource,
    handleMergeSubmit,
  } = useDealMerge({
    deals,
    clients,
    selectedDeal,
    currentUser,
    onMergeDeals,
  });

  const [isDeletingDeal, setIsDeletingDeal] = useState(false);
  const [isRestoringDeal, setIsRestoringDeal] = useState(false);
  const [isClosingDeal, setIsClosingDeal] = useState(false);
  const [isCloseDealPromptOpen, setIsCloseDealPromptOpen] = useState(false);
  const [closeDealReason, setCloseDealReason] = useState('');
  const [closeDealReasonError, setCloseDealReasonError] = useState<string | null>(null);
  const [isReopeningDeal, setIsReopeningDeal] = useState(false);
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [isSchedulingDelay, setIsSchedulingDelay] = useState(false);
  const [isDealRefreshing, setIsDealRefreshing] = useState(false);
  const [isPoliciesRefreshing, setIsPoliciesRefreshing] = useState(false);
  const [dealRefreshError, setDealRefreshError] = useState<string | null>(null);
  const [selectedDelayEventId, setSelectedDelayEventId] = useState<string | null>(null);
  const [delayLeadDays, setDelayLeadDays] = useState<number | null>(null);
  const [delayLeadDaysLoading, setDelayLeadDaysLoading] = useState(false);
  const [delayNextContactInput, setDelayNextContactInput] = useState<string | null>(null);
  const [delayValidationError, setDelayValidationError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DealTabId>('overview');
  const hasRequestedPoliciesRef = useRef(false);
  const {
    myTotalLabel,
    isConfirmModalOpen: isTimeTrackingConfirmModalOpen,
    continueTracking,
  } = useDealTimeTracking(selectedDeal?.id);

  const [isEditingDeal, setIsEditingDeal] = useState(false);

  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [isCreatingMailbox, setIsCreatingMailbox] = useState(false);
  const [isCheckingMailbox, setIsCheckingMailbox] = useState(false);
  const [mailboxActionError, setMailboxActionError] = useState<string | null>(null);
  const [mailboxActionSuccess, setMailboxActionSuccess] = useState<string | null>(null);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [completingTaskIds, setCompletingTaskIds] = useState<string[]>([]);

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

  const handleOpenClient = useCallback(
    (client: Client) => {
      onClientEdit?.(client);
      navigate('/clients');
    },
    [navigate, onClientEdit],
  );

  const [policySortKey, setPolicySortKey] = useState<PolicySortKey>('startDate');

  const [policySortOrder, setPolicySortOrder] = useState<'asc' | 'desc'>('asc');

  useEffect(() => {
    if (activeTab !== 'policies') {
      return;
    }
    if (!onRefreshPolicies || hasRequestedPoliciesRef.current) {
      return;
    }
    hasRequestedPoliciesRef.current = true;
    setIsPoliciesRefreshing(true);
    onRefreshPolicies()
      .catch(() => undefined)
      .finally(() => setIsPoliciesRefreshing(false));
  }, [activeTab, onRefreshPolicies]);

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
    canRecognizeSelectedDocumentFiles,
    isRecognizing,
    recognitionResults,
    recognitionMessage,
    isDocumentRecognizing,
    documentRecognitionResults,
    documentRecognitionMessage,
    isTrashing,
    trashMessage,
    isDownloading,
    downloadMessage,
    isRenaming,
    renameMessage,
    sortedDriveFiles,
    driveSortDirection,
    loadDriveFiles,
    handleDriveFileUpload,
    toggleDriveFileSelection,
    toggleDriveSortDirection,
    handleRecognizePolicies,
    handleRecognizeDocuments,
    handleTrashSelectedFiles,
    handleDownloadDriveFiles,
    handleRenameDriveFile,
    resetDriveState,
  } = useDealDriveFiles({
    selectedDeal,
    onDriveFolderCreated,
    onConfirmAction: async (message) => confirm(confirmTexts.deleteDriveFiles(message)),
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

  useEffect(() => {
    setActiveTab('overview');
  }, [selectedDeal?.id]);

  useEffect(() => {
    onDealSelectionBlockedChange?.(isTimeTrackingConfirmModalOpen);
    return () => onDealSelectionBlockedChange?.(false);
  }, [isTimeTrackingConfirmModalOpen, onDealSelectionBlockedChange]);

  useEffect(() => {
    setMailboxActionError(null);
    setMailboxActionSuccess(null);
    setIsCreatingMailbox(false);
    setIsCheckingMailbox(false);
  }, [selectedDeal?.id]);

  useEffect(() => {
    if (!isDelayModalOpen) {
      return;
    }
    let mounted = true;
    setDelayLeadDaysLoading(true);
    setDelayValidationError(null);
    fetchNotificationSettings()
      .then((response) => {
        if (!mounted) {
          return;
        }
        const leadDays = response.settings?.next_contact_lead_days ?? 90;
        setDelayLeadDays(leadDays);
      })
      .catch((err) => {
        console.error('Delay settings load error:', err);
        if (mounted) {
          setDelayLeadDays(null);
        }
      })
      .finally(() => {
        if (mounted) {
          setDelayLeadDaysLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [isDelayModalOpen]);

  const handleEditDealClick = useCallback(() => {
    if (!selectedDeal || isSelectedDealDeleted) {
      return;
    }

    setIsEditingDeal(true);
  }, [isSelectedDealDeleted, selectedDeal]);

  const handleDeleteDealClick = useCallback(async () => {
    if (!selectedDeal || isSelectedDealDeleted) {
      return;
    }

    setIsDeletingDeal(true);
    try {
      await onDeleteDeal(selectedDeal.id);
    } catch (err) {
      console.error('Ошибка удаления сделки:', err);
    } finally {
      setIsDeletingDeal(false);
    }
  }, [isSelectedDealDeleted, onDeleteDeal, selectedDeal]);

  const handleRestoreDealClick = useCallback(async () => {
    if (!selectedDeal || !isSelectedDealDeleted) {
      return;
    }

    setIsRestoringDeal(true);
    try {
      await onRestoreDeal(selectedDeal.id);
    } catch (err) {
      console.error('Ошибка восстановления сделки:', err);
    } finally {
      setIsRestoringDeal(false);
    }
  }, [isSelectedDealDeleted, onRestoreDeal, selectedDeal]);

  const handleCloseDealClick = useCallback(() => {
    if (!selectedDeal || isSelectedDealDeleted || isDealClosedStatus || !isCurrentUserSeller) {
      return;
    }
    setCloseDealReason('');
    setCloseDealReasonError(null);
    setIsCloseDealPromptOpen(true);
  }, [isCurrentUserSeller, isDealClosedStatus, isSelectedDealDeleted, selectedDeal]);

  const handleCloseDealConfirm = useCallback(async () => {
    if (!selectedDeal || isSelectedDealDeleted || isDealClosedStatus || !isCurrentUserSeller) {
      return;
    }

    const trimmedReason = closeDealReason.trim();
    if (!trimmedReason) {
      setCloseDealReasonError('Укажите причину закрытия сделки.');
      return;
    }

    setCloseDealReasonError(null);
    setIsClosingDeal(true);
    try {
      await onCloseDeal(selectedDeal.id, { reason: trimmedReason, status: 'won' });
      setIsCloseDealPromptOpen(false);
      setCloseDealReason('');
    } catch (err) {
      console.error('Ошибка закрытия сделки:', err);
    } finally {
      setIsClosingDeal(false);
    }
  }, [
    closeDealReason,
    isCurrentUserSeller,
    isDealClosedStatus,
    isSelectedDealDeleted,
    onCloseDeal,
    selectedDeal,
  ]);

  const handleReopenDealClick = useCallback(async () => {
    if (!selectedDeal || !isDealClosedStatus || !canReopenClosedDeal) {
      return;
    }

    setIsReopeningDeal(true);
    try {
      await onReopenDeal(selectedDeal.id);
    } catch (err) {
      console.error('Ошибка восстановления сделки:', err);
    } finally {
      setIsReopeningDeal(false);
    }
  }, [canReopenClosedDeal, isDealClosedStatus, onReopenDeal, selectedDeal]);

  const handleMergeClick = useCallback(() => {
    if (!selectedDeal || isSelectedDealDeleted) {
      return;
    }

    openMergeModal();
  }, [isSelectedDealDeleted, openMergeModal, selectedDeal]);

  const handleMarkTaskDone = async (taskId: string) => {
    if (completingTaskIds.includes(taskId)) {
      return;
    }

    setCompletingTaskIds((prev) => [...prev, taskId]);

    try {
      await onUpdateTask(taskId, { status: 'done' });
    } catch (err) {
      console.error('Ошибка отметки задачи как выполненной:', err);
    } finally {
      setCompletingTaskIds((prev) => prev.filter((id) => id !== taskId));
    }
  };

  const handleDelayModalConfirm = async () => {
    if (!selectedDeal || !selectedDelayEvent || !delayNextContactInput) {
      return;
    }
    const eventDate = new Date(selectedDelayEvent.date);
    const nextContactDate = new Date(delayNextContactInput);
    if (
      Number.isNaN(eventDate.getTime()) ||
      Number.isNaN(nextContactDate.getTime()) ||
      nextContactDate.getTime() > eventDate.getTime()
    ) {
      setDelayValidationError('Дата следующего контакта должна быть не позже даты события.');
      return;
    }
    setIsSchedulingDelay(true);
    try {
      if (onPostponeDeal) {
        await postponeDealDates({
          nextContactDate: delayNextContactInput,
          expectedClose: selectedDelayEvent.date,
        });
      } else {
        await updateDealDates({
          nextContactDate: delayNextContactInput,
          expectedClose: selectedDelayEvent.date,
        });
      }
      setIsDelayModalOpen(false);
    } catch (err) {
      console.error('Ошибка обновления даты сделки:', err);
    } finally {
      setIsSchedulingDelay(false);
    }
  };

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

  const relatedPolicies = useMemo(
    () => (selectedDeal ? policies.filter((p) => p.dealId === selectedDeal.id) : []),

    [policies, selectedDeal],
  );

  const sortedPolicies = useMemo(() => {
    const normalized = [...relatedPolicies];

    const multiplier = policySortOrder === 'asc' ? 1 : -1;

    normalized.sort((a, b) => {
      const valueA = getPolicySortValue(a, policySortKey);

      const valueB = getPolicySortValue(b, policySortKey);

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * multiplier;
      }

      const textA = String(valueA ?? '');

      const textB = String(valueB ?? '');

      return textA.localeCompare(textB, 'ru-RU', { sensitivity: 'base' }) * multiplier;
    });

    return normalized;
  }, [policySortKey, policySortOrder, relatedPolicies]);

  const relatedPayments = useMemo(
    () => (selectedDeal ? payments.filter((p) => p.dealId === selectedDeal.id) : []),

    [payments, selectedDeal],
  );

  const relatedTasks = useMemo(
    () => (selectedDeal ? tasks.filter((t) => t.dealId === selectedDeal.id) : []),

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

  const selectedDelayEvent = useMemo(() => {
    return resolveSelectedDelayEvent(
      dealEvents,
      selectedDelayEventId,
      eventWindow.nextEvent?.id ?? null,
    );
  }, [dealEvents, eventWindow.nextEvent?.id, selectedDelayEventId]);

  const normalizedDelayLeadDays = Math.max(1, delayLeadDays ?? 90);

  const selectedDelayEventNextContact = useMemo(
    () => calculateNextContactForEvent(selectedDelayEvent, normalizedDelayLeadDays),
    [normalizedDelayLeadDays, selectedDelayEvent],
  );

  useEffect(() => {
    if (!isDelayModalOpen) {
      return;
    }
    setDelayNextContactInput(selectedDelayEventNextContact);
    setDelayValidationError(null);
  }, [isDelayModalOpen, selectedDelayEvent?.id, selectedDelayEventNextContact]);

  useEffect(() => {
    if (!isDelayModalOpen) {
      return;
    }
    const defaultId = eventWindow.nextEvent?.id ?? dealEvents[0]?.id ?? null;
    setSelectedDelayEventId((prev) => prev ?? defaultId);
  }, [dealEvents, eventWindow.nextEvent?.id, isDelayModalOpen]);

  useEffect(() => {
    if (!isDelayModalOpen) {
      setSelectedDelayEventId(null);
      setDelayNextContactInput(null);
      setDelayValidationError(null);
    }
  }, [isDelayModalOpen]);

  const quotes = useMemo(() => selectedDeal?.quotes ?? [], [selectedDeal?.quotes]);
  const tasksCount = useMemo(
    () => relatedTasks.filter((task) => !task.deletedAt).length,
    [relatedTasks],
  );
  const quotesCount = useMemo(() => quotes.filter((quote) => !quote.deletedAt).length, [quotes]);
  const policiesCount = relatedPolicies.length;
  const chatCount = chatMessages.length;
  const filesCount = sortedDriveFiles.length;

  const displayedTasks = useMemo(() => {
    const active = relatedTasks.filter((task) => task.status !== 'done');

    const done = relatedTasks.filter((task) => task.status === 'done');

    return [...active, ...done];
  }, [relatedTasks]);

  const renderTasksTab = () => (
    <TasksTab
      selectedDeal={selectedDeal}
      displayedTasks={displayedTasks}
      relatedTasks={relatedTasks}
      onCreateTaskClick={() => setIsCreatingTask(true)}
      onEditTaskClick={(taskId) => setEditingTaskId(taskId)}
      onMarkTaskDone={handleMarkTaskDone}
      onDeleteTask={onDeleteTask}
      completingTaskIds={completingTaskIds}
    />
  );

  const renderPoliciesTab = () => (
    <PoliciesTab
      selectedDeal={selectedDeal}
      sortedPolicies={sortedPolicies}
      policySortKey={policySortKey}
      policySortOrder={policySortOrder}
      setPolicySortKey={setPolicySortKey}
      setPolicySortOrder={setPolicySortOrder}
      onRequestAddPolicy={onRequestAddPolicy}
      onDeletePolicy={onDeletePolicy}
      onRequestEditPolicy={onRequestEditPolicy}
      relatedPayments={relatedPayments}
      clients={clients}
      onOpenClient={handleOpenClient}
      setEditingPaymentId={setEditingPaymentId}
      setCreatingPaymentPolicyId={setCreatingPaymentPolicyId}
      setCreatingFinancialRecordContext={setCreatingFinancialRecordContext}
      setEditingFinancialRecordId={setEditingFinancialRecordId}
      onDeleteFinancialRecord={onDeleteFinancialRecord}
      onDeletePayment={onDeletePayment}
      isLoading={isPoliciesRefreshing}
    />
  );

  const renderQuotesTab = () => (
    <QuotesTab
      selectedDeal={selectedDeal}
      quotes={quotes}
      onRequestAddQuote={onRequestAddQuote}
      onRequestEditQuote={onRequestEditQuote}
      onDeleteQuote={onDeleteQuote}
    />
  );

  const renderFilesTab = () => (
    <FilesTab
      selectedDeal={selectedDeal}
      isDriveLoading={isDriveLoading}
      loadDriveFiles={loadDriveFiles}
      onUploadDriveFile={handleDriveFileUpload}
      isSelectedDealDeleted={isSelectedDealDeleted}
      selectedDriveFileIds={selectedDriveFileIds}
      toggleDriveFileSelection={toggleDriveFileSelection}
      handleRecognizePolicies={handleRecognizePolicies}
      handleRecognizeDocuments={handleRecognizeDocuments}
      canRecognizeSelectedFiles={canRecognizeSelectedFiles}
      canRecognizeSelectedDocumentFiles={canRecognizeSelectedDocumentFiles}
      isRecognizing={isRecognizing}
      recognitionResults={recognitionResults}
      recognitionMessage={recognitionMessage}
      isDocumentRecognizing={isDocumentRecognizing}
      documentRecognitionResults={documentRecognitionResults}
      documentRecognitionMessage={documentRecognitionMessage}
      isTrashing={isTrashing}
      trashMessage={trashMessage}
      isDownloading={isDownloading}
      downloadMessage={downloadMessage}
      isRenaming={isRenaming}
      renameMessage={renameMessage}
      handleTrashSelectedFiles={handleTrashSelectedFiles}
      handleDownloadDriveFiles={handleDownloadDriveFiles}
      handleRenameDriveFile={handleRenameDriveFile}
      driveError={driveError}
      sortedDriveFiles={sortedDriveFiles}
      driveSortDirection={driveSortDirection}
      toggleDriveSortDirection={toggleDriveSortDirection}
      isCreatingMailbox={isCreatingMailbox}
      isCheckingMailbox={isCheckingMailbox}
      mailboxActionError={mailboxActionError}
      mailboxActionSuccess={mailboxActionSuccess}
      onCreateMailbox={async () => {
        const dealId = selectedDeal?.id;
        if (!dealId) {
          return;
        }
        setMailboxActionError(null);
        setMailboxActionSuccess(null);
        setIsCreatingMailbox(true);
        try {
          const result = await onCreateDealMailbox(dealId);
          const passwordPart = result.mailboxInitialPassword
            ? ` Пароль: ${result.mailboxInitialPassword}`
            : '';
          setMailboxActionSuccess(
            `Ящик создан: ${result.deal.mailboxEmail ?? '—'}.${passwordPart}`,
          );
        } catch (err) {
          console.error('Ошибка создания ящика сделки:', err);
          setMailboxActionError(
            err instanceof Error ? err.message : 'Не удалось создать почтовый ящик сделки.',
          );
        } finally {
          setIsCreatingMailbox(false);
        }
      }}
      onCheckMailbox={async () => {
        const dealId = selectedDeal?.id;
        if (!dealId) {
          return;
        }
        setMailboxActionError(null);
        setMailboxActionSuccess(null);
        setIsCheckingMailbox(true);
        try {
          const result = await onCheckDealMailbox(dealId);
          const sync = result.mailboxSync;
          setMailboxActionSuccess(
            `Почта проверена: обработано ${sync.processed}, пропущено ${sync.skipped}, ошибок ${sync.failed}, удалено ${sync.deleted}.`,
          );
          await reloadNotes();
          await loadDriveFiles();
        } catch (err) {
          console.error('Ошибка проверки почты сделки:', err);
          setMailboxActionError(err instanceof Error ? err.message : 'Не удалось проверить почту.');
        } finally {
          setIsCheckingMailbox(false);
        }
      }}
    />
  );

  const renderChatTab = () => (
    <ChatTab
      selectedDeal={selectedDeal}
      chatMessages={chatMessages}
      isChatLoading={isChatLoading}
      currentUser={currentUser}
      onSendMessage={handleChatSendMessage}
      onDeleteMessage={handleChatDelete}
    />
  );

  const renderActivityTab = () => (
    <section className="app-panel p-6 shadow-none space-y-4">
      <div className="flex items-center justify-between">
        <p className="app-label">История</p>
      </div>
      {activityError && <InlineAlert>{activityError}</InlineAlert>}
      <ActivityTimeline activities={activityLogs} isLoading={isActivityLoading} />
    </section>
  );

  const handleRefreshDeal = useCallback(async () => {
    if (!selectedDeal?.id || isDealRefreshing) {
      return;
    }

    setDealRefreshError(null);
    setIsDealRefreshing(true);
    try {
      await onRefreshDeal?.(selectedDeal.id);
      const operations: Promise<unknown>[] = [reloadNotes(), loadDriveFiles()];
      if (onRefreshPolicies) {
        setIsPoliciesRefreshing(true);
        operations.push(
          onRefreshPolicies({ force: true }).finally(() => {
            setIsPoliciesRefreshing(false);
          }),
        );
      }
      if (activeTab === 'chat') {
        operations.push(loadChatMessages());
      }
      if (activeTab === 'history') {
        operations.push(loadActivityLogs());
      }
      await Promise.all(operations);
    } catch (err) {
      console.error('Ошибка обновления сделки:', err);
      setDealRefreshError(
        err instanceof Error ? err.message : 'Не удалось обновить данные сделки.',
      );
    } finally {
      setIsDealRefreshing(false);
    }
  }, [
    activeTab,
    isDealRefreshing,
    loadActivityLogs,
    loadChatMessages,
    loadDriveFiles,
    onRefreshDeal,
    onRefreshPolicies,
    reloadNotes,
    selectedDeal?.id,
  ]);

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': {
        return (
          <div className="space-y-6">
            <DealNotesSection
              dealId={selectedDeal?.id}
              notes={notes}
              notesLoading={notesLoading}
              notesFilter={notesFilter}
              noteDraft={noteDraft}
              noteIsImportant={noteIsImportant}
              notesError={notesError}
              notesAction={notesAction}
              noteAttachments={noteAttachments}
              noteAttachmentsUploading={noteAttachmentsUploading}
              onSetFilter={setNotesFilter}
              onSetDraft={setNoteDraft}
              onToggleImportant={setNoteIsImportant}
              onAddNote={handleAddNote}
              onAttachNoteFile={attachNoteFile}
              onRemoveNoteAttachment={removeNoteAttachment}
              onArchiveNote={handleArchiveNote}
              onRestoreNote={handleRestoreNote}
            />
          </div>
        );
      }
      case 'tasks':
        return renderTasksTab();
      case 'policies':
        return renderPoliciesTab();
      case 'quotes':
        return renderQuotesTab();
      case 'files':
        return renderFilesTab();
      case 'chat':
        return renderChatTab();
      case 'history':
        return renderActivityTab();
      default:
        return null;
    }
  };

  const selectedClientDisplayName = selectedClient?.name || selectedDeal?.clientName || '—';

  return (
    <>
      <div className="px-4 py-5 space-y-4">
        {selectedDeal ? (
          <div
            className={`relative rounded-2xl border bg-white shadow-md p-6 space-y-6 ${
              selectedDeal.isPinned
                ? 'border-rose-500 ring-2 ring-rose-500/30'
                : 'border-sky-500 ring-2 ring-sky-400/30'
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
                onDelay={() => setIsDelayModalOpen(true)}
                onRefresh={handleRefreshDeal}
                isRefreshing={isDealRefreshing}
              />
            </div>
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
                onChange={setActiveTab}
                tabCounts={{
                  tasks: tasksCount,
                  quotes: quotesCount,
                  policies: policiesCount,
                  chat: chatCount,
                  files: filesCount,
                }}
                loadingByTab={{
                  policies: isPoliciesRefreshing,
                  chat: isChatLoading,
                  files: isDriveLoading,
                  history: isActivityLoading,
                }}
              />
              <div
                className="pt-6"
                role="tabpanel"
                id={`deal-tabpanel-${activeTab}`}
                aria-labelledby={`deal-tab-${activeTab}`}
                tabIndex={0}
              >
                {renderTabContent()}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
            Выберите сделку, чтобы увидеть подробности.
          </div>
        )}
      </div>
      {isEditingDeal && selectedDeal && (
        <Modal
          title="Редактировать сделку"
          onClose={() => setIsEditingDeal(false)}
          size="sm"
          zIndex={50}
          closeOnOverlayClick={false}
        >
          <div className="space-y-3">
            <DealForm
              key={selectedDeal.id}
              clients={clients}
              users={users}
              initialValues={{
                title: selectedDeal.title,
                description: selectedDeal.description ?? '',
                clientId: selectedDeal.clientId,
                executorId: selectedDeal.executor ?? null,
                sellerId: selectedDeal.seller ?? null,
                source: selectedDeal.source ?? '',
                nextContactDate: selectedDeal.nextContactDate ?? null,
                expectedClose: selectedDeal.expectedClose ?? null,
                visibleUserIds: selectedDeal.visibleUsers ?? [],
              }}
              mode="edit"
              showSellerField
              showNextContactField
              quickNextContactOptions={quickInlineDateOptions}
              onQuickNextContactShift={handleQuickNextContactShift}
              onRequestAddClient={onRequestAddClient}
              onSubmit={async (data) => {
                await onUpdateDeal(selectedDeal.id, data);
                setIsEditingDeal(false);
              }}
            />
            <button
              type="button"
              onClick={() => setIsEditingDeal(false)}
              className={`${BTN_SECONDARY} w-full`}
            >
              Отмена
            </button>
          </div>
        </Modal>
      )}
      {isCreatingTask && selectedDeal && (
        <Modal
          title="Новая задача"
          onClose={() => setIsCreatingTask(false)}
          size="sm"
          zIndex={50}
          closeOnOverlayClick={false}
        >
          <AddTaskForm
            dealId={selectedDeal.id}
            users={users}
            defaultAssigneeId={selectedDeal.executor ?? null}
            onSubmit={async (data) => {
              await onCreateTask(selectedDeal.id, data);
              setIsCreatingTask(false);
            }}
            onCancel={() => setIsCreatingTask(false)}
          />
        </Modal>
      )}
      {editingTaskId && selectedDeal && (
        <Modal
          title="Редактировать задачу"
          onClose={() => setEditingTaskId(null)}
          size="sm"
          zIndex={50}
          closeOnOverlayClick={false}
        >
          {relatedTasks.find((t) => t.id === editingTaskId) && (
            <AddTaskForm
              dealId={selectedDeal.id}
              task={relatedTasks.find((t) => t.id === editingTaskId)}
              users={users}
              defaultAssigneeId={selectedDeal.executor ?? null}
              onSubmit={async (data) => {
                await onUpdateTask(editingTaskId, data);
                setEditingTaskId(null);
              }}
              onCancel={() => setEditingTaskId(null)}
            />
          )}
        </Modal>
      )}
      {isPaymentModalOpen && selectedDeal && (
        <PaymentModal
          isOpen
          title={editingPaymentId === 'new' ? 'Создать платеж' : 'Редактировать платеж'}
          payment={editingPayment}
          dealId={selectedDeal.id}
          dealTitle={selectedDeal.title}
          policies={relatedPolicies}
          fixedPolicyId={paymentFixedPolicyId}
          onClose={closePaymentModal}
          onSubmit={async (data) => {
            if (editingPaymentId === 'new') {
              await onAddPayment(data);
            } else if (editingPaymentId) {
              await onUpdatePayment(editingPaymentId, data);
            }
            closePaymentModal();
          }}
        />
      )}
      {isFinancialRecordModalOpen && selectedDeal && (
        <FinancialRecordModal
          isOpen
          title={editingFinancialRecordId ? 'Редактировать запись' : 'Новая финансовая запись'}
          onClose={closeFinancialRecordModal}
          paymentId={financialRecordPaymentId}
          defaultRecordType={financialRecordDefaultRecordType}
          record={editingFinancialRecord}
          onSubmit={async (data) => {
            if (editingFinancialRecordId) {
              await onUpdateFinancialRecord(editingFinancialRecordId, data);
            } else {
              await onAddFinancialRecord(data);
            }
            closeFinancialRecordModal();
          }}
        />
      )}
      {isDelayModalOpen && selectedDeal && (
        <DealDelayModal
          deal={selectedDeal}
          selectedEvent={selectedDelayEvent}
          selectedEventNextContact={selectedDelayEventNextContact}
          nextContactValue={delayNextContactInput}
          upcomingEvents={upcomingEvents}
          pastEvents={pastEvents}
          isSchedulingDelay={isSchedulingDelay}
          isLeadDaysLoading={delayLeadDaysLoading}
          validationError={delayValidationError}
          onClose={() => setIsDelayModalOpen(false)}
          onEventSelect={setSelectedDelayEventId}
          onNextContactChange={(value) => {
            setDelayNextContactInput(value);
            setDelayValidationError(null);
          }}
          onConfirm={handleDelayModalConfirm}
        />
      )}
      {isMergeModalOpen && selectedDeal && (
        <DealMergeModal
          targetDeal={selectedDeal}
          selectedClientName={selectedClientDisplayName}
          mergeSearch={mergeSearch}
          onMergeSearchChange={setMergeSearch}
          mergeList={mergeList}
          mergeSources={mergeSources}
          toggleMergeSource={toggleMergeSource}
          mergeError={mergeError}
          isLoading={isMergeSearchLoading}
          isActiveSearch={isMergeSearchActive}
          searchQuery={mergeQuery}
          isMerging={isMerging}
          onClose={closeMergeModal}
          onSubmit={handleMergeSubmit}
        />
      )}
      <PromptDialog
        isOpen={isCloseDealPromptOpen}
        title="Закрыть сделку"
        label="Причина закрытия"
        value={closeDealReason}
        onChange={(value) => {
          setCloseDealReason(value);
          setCloseDealReasonError(null);
        }}
        onCancel={() => {
          if (isClosingDeal) {
            return;
          }
          setIsCloseDealPromptOpen(false);
          setCloseDealReasonError(null);
        }}
        onConfirm={() => {
          void handleCloseDealConfirm();
        }}
        confirmLabel="Закрыть сделку"
        isSubmitting={isClosingDeal}
        placeholder="Напишите причину"
        error={closeDealReasonError}
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
