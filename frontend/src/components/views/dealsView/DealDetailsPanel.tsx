import React, { useCallback, useEffect, useMemo, useState } from 'react';

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
import { useDealInlineDates } from './hooks/useDealInlineDates';
import { useDealMerge } from './hooks/useDealMerge';

import { ActivityTimeline } from '../../ActivityTimeline';
import { DealForm, DealFormValues } from '../../forms/DealForm';
import { AddTaskForm, AddTaskFormValues } from '../../forms/AddTaskForm';
import { AddPaymentForm, AddPaymentFormValues } from '../../forms/AddPaymentForm';
import {
  AddFinancialRecordForm,
  AddFinancialRecordFormValues,
} from '../../forms/AddFinancialRecordForm';
import {
  DealTabId,
  FinancialRecordCreationContext,
  getDeadlineTone,
  getPolicySortValue,
  getUserDisplayName,
  PolicySortKey,
  closedDealStatuses,
} from './helpers';

import type { DealEvent } from './eventUtils';
import { buildDealEvents, buildEventWindow } from './eventUtils';
import { TasksTab } from './tabs/TasksTab';
import { PoliciesTab } from './tabs/PoliciesTab';
import { QuotesTab } from './tabs/QuotesTab';
import { FilesTab } from './tabs/FilesTab';
import { ChatTab } from './tabs/ChatTab';
import { DealDelayModal, DealMergeModal } from './DealDetailsModals';
import { DealTabs } from './DealTabs';
import { DealHeader } from './DealHeader';
import { DealActions } from './DealActions';
import { DealNotesSection } from './DealNotesSection';
import { DealDateControls } from './DealDateControls';
import { useDealNotes } from './hooks/useDealNotes';
import { useDealDriveFiles } from './hooks/useDealDriveFiles';


interface DealDetailsPanelProps {
  deals: Deal[];
  clients: Client[];
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
  onCloseDeal: (dealId: string, payload: { reason: string; status?: 'won' | 'lost' }) => Promise<void>;
  onReopenDeal: (dealId: string) => Promise<void>;
  onUpdateDeal: (dealId: string, data: DealFormValues) => Promise<void>;
  onMergeDeals: (targetDealId: string, sourceDealIds: string[], resultingClientId?: string) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
  onRequestEditQuote: (quote: Quote) => void;
  onRequestAddPolicy: (dealId: string) => void;
  onRequestEditPolicy: (policy: Policy) => void;
  onRequestAddClient: () => void;
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onRefreshPolicies?: () => Promise<void>;
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null,
    fileId?: string | null,
    parsedFileIds?: string[]
  ) => void;
  onAddPayment: (values: AddPaymentFormValues) => Promise<void>;
  onUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;
  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;
  onUpdateFinancialRecord: (recordId: string, values: AddFinancialRecordFormValues) => Promise<void>;
  onDeleteFinancialRecord: (recordId: string) => Promise<void>;
  onDriveFolderCreated: (dealId: string, folderId: string) => void;
  onFetchChatMessages: (dealId: string) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<ChatMessage>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (dealId: string, includeDeleted?: boolean) => Promise<ActivityLog[]>;
  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  onDeleteDeal: (dealId: string) => Promise<void>;
  onRestoreDeal: (dealId: string) => Promise<void>;
}


export const DealDetailsPanel: React.FC<DealDetailsPanelProps> = ({
  deals,
  clients,
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
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onDeleteFinancialRecord,
  onDriveFolderCreated,
  onFetchChatMessages,
  onSendChatMessage,
  onDeleteChatMessage,
  onFetchDealHistory,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  onDeleteDeal,
  onRestoreDeal,
}) => {
  const sellerDisplayName = sellerUser
    ? getUserDisplayName(sellerUser)
    : selectedDeal?.sellerName || '-';
  const executorDisplayName = executorUser
    ? getUserDisplayName(executorUser)
    : selectedDeal?.executorName || '-';
  const headerExpectedCloseTone = getDeadlineTone(selectedDeal?.expectedClose);

  const isSelectedDealDeleted = Boolean(selectedDeal?.deletedAt);
  const isDealClosedStatus = Boolean(
    selectedDeal && closedDealStatuses.includes(selectedDeal.status)
  );
  const isCurrentUserSeller = Boolean(
    selectedDeal && currentUser && selectedDeal.seller === currentUser.id
  );
  const currentUserIsAdmin = Boolean(currentUser?.roles?.includes('Admin'));
  const canReopenClosedDeal = Boolean(
    selectedDeal && (isCurrentUserSeller || currentUserIsAdmin)
  );

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
  const [isReopeningDeal, setIsReopeningDeal] = useState(false);
  const [isDelayModalOpen, setIsDelayModalOpen] = useState(false);
  const [isSchedulingDelay, setIsSchedulingDelay] = useState(false);
  const [selectedDelayEventId, setSelectedDelayEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<DealTabId>('overview');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isChatLoading, setIsChatLoading] = useState(false);

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);

  const [isActivityLoading, setIsActivityLoading] = useState(false);

  const [isEditingDeal, setIsEditingDeal] = useState(false);

  const [isCreatingTask, setIsCreatingTask] = useState(false);

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);

  const [completingTaskIds, setCompletingTaskIds] = useState<string[]>([]);

  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);

  const [editingFinancialRecordId, setEditingFinancialRecordId] = useState<string | null>(null);

  const [creatingFinancialRecordContext, setCreatingFinancialRecordContext] =

    useState<FinancialRecordCreationContext | null>(null);

  const [creatingPaymentPolicyId, setCreatingPaymentPolicyId] = useState<string | null>(null);

  const [policySortKey] = useState<PolicySortKey>('startDate');

  const [policySortOrder] = useState<'asc' | 'desc'>('asc');

  const {
    isDriveLoading,
    driveError,
    selectedDriveFileIds,
    canRecognizeSelectedFiles,
    isRecognizing,
    recognitionResults,
    recognitionMessage,
    sortedDriveFiles,
    loadDriveFiles,
    handleDriveFileUpload,
    toggleDriveFileSelection,
    handleRecognizePolicies,
    resetDriveState,
  } = useDealDriveFiles({
    selectedDeal,
    onDriveFolderCreated,
    onRefreshPolicies,
    onPolicyDraftReady,
  });

  const {
    notes,
    notesLoading,
    notesFilter,
    noteDraft,
    notesError,
    notesAction,
    setNoteDraft,
    setNotesFilter,
    addNote: handleAddNote,
    archiveNote: handleArchiveNote,
    restoreNote: handleRestoreNote,
  } = useDealNotes(selectedDeal?.id);
  const {
    nextContactInputValue,
    expectedCloseInputValue,
    handleNextContactChange,
    handleExpectedCloseChange,
    handleNextContactBlur,
    handleExpectedCloseBlur,
    handleQuickNextContactShift,
    quickInlineShift,
    quickInlineDateOptions,
    updateDealDates,
  } = useDealInlineDates({
    selectedDeal,
    sortedDeals,
    onUpdateDeal,
    onSelectDeal,
  });



  useEffect(() => {

    setActiveTab('overview');

  }, [selectedDeal?.id]);



  const loadChatMessages = useCallback(async () => {

    const dealId = selectedDeal?.id;

    if (!dealId) {

      return;

    }

    setIsChatLoading(true);

    try {

      const messages = await onFetchChatMessages(dealId);

      setChatMessages(messages);

    } catch (err) {

      console.error('Ошибка загрузки сообщений:', err);

    } finally {

      setIsChatLoading(false);

    }

  }, [onFetchChatMessages, selectedDeal?.id]);



  const handleChatSendMessage = useCallback(

    async (body: string): Promise<ChatMessage> => {

      const dealId = selectedDeal?.id;

      if (!dealId) {

        throw new Error('Сделка не выбрана');

      }

      const newMessage = await onSendChatMessage(dealId, body);

      setChatMessages((prev) => [...prev, newMessage]);

      return newMessage;

    },

    [onSendChatMessage, selectedDeal?.id]

  );



  const handleChatDelete = useCallback(

    async (messageId: string) => {

      const dealId = selectedDeal?.id;

      if (!dealId) {

        return;

      }

      await onDeleteChatMessage(messageId);

      setChatMessages((prev) => prev.filter((message) => message.id !== messageId));

    },

    [onDeleteChatMessage, selectedDeal?.id]

  );



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

  const handleCloseDealClick = useCallback(async () => {
    if (!selectedDeal || isSelectedDealDeleted || isDealClosedStatus || !isCurrentUserSeller) {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const reason = window.prompt('Укажите причину закрытия сделки');
    const trimmedReason = reason?.trim();
    if (!trimmedReason) {
      return;
    }

    setIsClosingDeal(true);

    try {
      await onCloseDeal(selectedDeal.id, { reason: trimmedReason, status: 'won' });
    } catch (err) {
      console.error('Ошибка закрытия сделки:', err);
    } finally {
    setIsClosingDeal(false);
    }
  }, [isCurrentUserSeller, isDealClosedStatus, isSelectedDealDeleted, onCloseDeal, selectedDeal]);

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



  const loadActivityLogs = useCallback(async () => {

    const dealId = selectedDeal?.id;

    if (!dealId) {

      return;

    }

    setIsActivityLoading(true);

    try {

      const logs = await onFetchDealHistory(dealId, Boolean(selectedDeal?.deletedAt));

      setActivityLogs(logs);

    } catch (err) {

      console.error('Ошибка загрузки истории:', err);

    } finally {

      setIsActivityLoading(false);

    }

  }, [onFetchDealHistory, selectedDeal?.id, selectedDeal?.deletedAt]);



  // Reload activity log when the "history" tab becomes active

  useEffect(() => {

    if (activeTab === 'history') {

      void loadActivityLogs();

    }

  }, [activeTab, loadActivityLogs]);



  // Reload chat messages when the "chat" tab becomes active

  useEffect(() => {

    if (activeTab === 'chat') {

      void loadChatMessages();

    }

  }, [activeTab, loadChatMessages]);





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
    if (!selectedDeal || !selectedDelayEvent || !selectedDelayEventNextContact) {
      return;
    }
    setIsSchedulingDelay(true);
    try {
      await updateDealDates({
        nextContactDate: selectedDelayEventNextContact,
        expectedClose: selectedDelayEvent.date,
      });
      setIsDelayModalOpen(false);
    } catch (err) {
      console.error('Ошибка обновления даты сделки:', err);
    } finally {
      setIsSchedulingDelay(false);
    }
  };

  useEffect(() => {

    if (activeTab === 'files') {

      void loadDriveFiles();

      return;

    }



    resetDriveState();

  }, [activeTab, loadDriveFiles, resetDriveState]);



  const relatedPolicies = useMemo(

    () => (selectedDeal ? policies.filter((p) => p.dealId === selectedDeal.id) : []),

    [policies, selectedDeal]

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

    [payments, selectedDeal]

  );

  const relatedTasks = useMemo(

    () => (selectedDeal ? tasks.filter((t) => t.dealId === selectedDeal.id) : []),

    [selectedDeal, tasks]

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

  const calculateNextContactForEvent = (event: DealEvent | null) => {
    if (!event) {
      return null;
    }
    const offsetDays = event.type === 'payment' ? 30 : 45;
    const target = new Date(event.date);
    target.setDate(target.getDate() - offsetDays);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const nextContactMs = Math.max(target.getTime(), today.getTime());
    return new Date(nextContactMs).toISOString().split('T')[0];
  };

  const selectedDelayEvent = useMemo(() => {
    const preferredId =
      selectedDelayEventId ?? eventWindow.nextEvent?.id ?? dealEvents[0]?.id ?? null;
    return dealEvents.find((event) => event.id === preferredId) ?? null;
  }, [dealEvents, eventWindow.nextEvent?.id, selectedDelayEventId]);

  const selectedDelayEventNextContact = useMemo(
    () => calculateNextContactForEvent(selectedDelayEvent),
    [selectedDelayEvent]
  );

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
    }
  }, [isDelayModalOpen]);

  const quotes = selectedDeal?.quotes ?? [];



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

        onRequestAddPolicy={onRequestAddPolicy}

        onDeletePolicy={onDeletePolicy}

        onRequestEditPolicy={onRequestEditPolicy}

        relatedPayments={relatedPayments}

        setEditingPaymentId={setEditingPaymentId}

        setCreatingPaymentPolicyId={setCreatingPaymentPolicyId}

        setCreatingFinancialRecordContext={setCreatingFinancialRecordContext}

        setEditingFinancialRecordId={setEditingFinancialRecordId}

        onDeleteFinancialRecord={onDeleteFinancialRecord}

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

      canRecognizeSelectedFiles={canRecognizeSelectedFiles}

      isRecognizing={isRecognizing}

      recognitionResults={recognitionResults}

      recognitionMessage={recognitionMessage}

      driveError={driveError}

      sortedDriveFiles={sortedDriveFiles}

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
    <ActivityTimeline activities={activityLogs} isLoading={isActivityLoading} />
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': {
        return (
          <div className="space-y-6">
            <DealNotesSection
              notes={notes}
              notesLoading={notesLoading}
              notesFilter={notesFilter}
              noteDraft={noteDraft}
              notesError={notesError}
              notesAction={notesAction}
              onSetFilter={setNotesFilter}
              onSetDraft={setNoteDraft}
              onAddNote={handleAddNote}
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

  const selectedClientDisplayName =
    selectedClient?.name || selectedDeal?.clientName || '—';

  return (
    <>
      <div className="px-4 py-5 space-y-4">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <p className="text-[10px] tracking-[0.4em] text-slate-400">
                <span className="uppercase">Выбранная сделка:</span>
                {selectedDeal ? (
                  <span className="ml-2 inline-block text-base font-semibold text-slate-900">
                    {selectedDeal.title}
                  </span>
                ) : (
                  <span className="ml-2 inline-block text-sm font-semibold text-slate-500">
                    Выберите сделку выше
                  </span>
                )}
              </p>
            </div>
            {selectedDeal ? (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-md p-6 space-y-6">
                <div className="flex flex-col gap-4">
                  <DealHeader
                    deal={selectedDeal}
                    clientDisplayName={selectedClientDisplayName}
                    clientPhone={selectedClient?.phone}
                    sellerDisplayName={sellerDisplayName}
                    executorDisplayName={executorDisplayName}
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
                  />
                </div>
                <DealDateControls
                  nextContactValue={nextContactInputValue}
                  expectedCloseValue={expectedCloseInputValue}
                  headerExpectedCloseTone={headerExpectedCloseTone}
                  quickOptions={quickInlineDateOptions}
                  onNextContactChange={handleNextContactChange}
                  onNextContactBlur={handleNextContactBlur}
                  onExpectedCloseChange={handleExpectedCloseChange}
                  onExpectedCloseBlur={handleExpectedCloseBlur}
                  onQuickShift={quickInlineShift}
                />
                <div>
                  <DealTabs activeTab={activeTab} onChange={setActiveTab} />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Редактировать сделку</h3>
              <button
                onClick={() => setIsEditingDeal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6 space-y-3">
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
                }}
                mode="edit"
                showSellerField
                showNextContactField
                quickNextContactOptions={quickInlineDateOptions}
                expectedCloseRequired
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
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
      {isCreatingTask && selectedDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Новая задача</h3>
              <button
                onClick={() => setIsCreatingTask(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
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
            </div>
          </div>
        </div>
      )}
      {editingTaskId && selectedDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Редактировать задачу</h3>
              <button
                onClick={() => setEditingTaskId(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
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
            </div>
          </div>
        </div>
      )}
      {editingPaymentId && selectedDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingPaymentId === 'new' ? 'Создать платеж' : 'Редактировать платеж'}
              </h3>
              <button
                onClick={() => setEditingPaymentId(null)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <AddPaymentForm
                payment={
                  editingPaymentId !== 'new'
                    ? payments.find((p) => p.id === editingPaymentId)
                    : undefined
                }
                dealId={selectedDeal.id}
                dealTitle={selectedDeal.title}
                policies={relatedPolicies}
                fixedPolicyId={editingPaymentId === 'new' ? creatingPaymentPolicyId ?? undefined : undefined}
                onSubmit={async (data) => {
                  if (editingPaymentId === 'new') {
                    await onAddPayment(data);
                  } else {
                    await onUpdatePayment(editingPaymentId, data);
                  }
                  setEditingPaymentId(null);
                  setCreatingPaymentPolicyId(null);
                }}
                onCancel={() => {
                  setEditingPaymentId(null);
                  setCreatingPaymentPolicyId(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
      {(editingFinancialRecordId || creatingFinancialRecordContext) && selectedDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingFinancialRecordId ? 'Редактировать запись' : 'Новая финансовая запись'}
              </h3>
              <button
                onClick={() => {
                  setEditingFinancialRecordId(null);
                  setCreatingFinancialRecordContext(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <AddFinancialRecordForm
                paymentId={creatingFinancialRecordContext?.paymentId || ''}
                defaultRecordType={creatingFinancialRecordContext?.recordType}
                record={
                  editingFinancialRecordId
                    ? financialRecords.find((r) => r.id === editingFinancialRecordId)
                    : undefined
                }
                onSubmit={async (data) => {
                  if (editingFinancialRecordId) {
                    await onUpdateFinancialRecord(editingFinancialRecordId, data);
                  } else {
                    await onAddFinancialRecord(data);
                  }
                  setEditingFinancialRecordId(null);
                  setCreatingFinancialRecordContext(null);
                }}
                onCancel={() => {
                  setEditingFinancialRecordId(null);
                  setCreatingFinancialRecordContext(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
      {isDelayModalOpen && selectedDeal && (
        <DealDelayModal
          deal={selectedDeal}
          selectedEvent={selectedDelayEvent}
          selectedEventNextContact={selectedDelayEventNextContact}
          upcomingEvents={upcomingEvents}
          pastEvents={pastEvents}
          isSchedulingDelay={isSchedulingDelay}
          onClose={() => setIsDelayModalOpen(false)}
          onEventSelect={setSelectedDelayEventId}
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
    </>
  );
};
