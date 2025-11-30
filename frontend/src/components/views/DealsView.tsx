import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {

  ActivityLog,

  ChatMessage,

  Client,

  Deal,

  DealStatus,

  DriveFile,

  FinancialRecord,

  Note,

  Payment,

  Policy,

  PolicyRecognitionResult,

  Quote,

  Task,

  User,

} from '../../types';

import {

  fetchDealDriveFiles,

  uploadDealDriveFile,

  fetchDealNotes,

  createNote,

  archiveNote,

  restoreNote,

  recognizeDealPolicies,

} from '../../api';

import { ActivityTimeline } from '../ActivityTimeline';

import { UserBadge } from '../common/UserBadge';

import { EditDealForm, EditDealFormValues } from '../forms/EditDealForm';

import { AddTaskForm, AddTaskFormValues } from '../forms/AddTaskForm';

import { AddPaymentForm, AddPaymentFormValues } from '../forms/AddPaymentForm';

import {

  AddFinancialRecordForm,

  AddFinancialRecordFormValues,

} from '../forms/AddFinancialRecordForm';

import {

  DEAL_TABS,

  DealTabId,

  FinancialRecordCreationContext,

  formatCurrency,

  formatDate,

  formatDeletedAt,

  getDatePlusDays,

  getDeadlineTone,

  getPolicySortValue,

  getUserDisplayName,

  QUICK_NEXT_CONTACT_OPTIONS,

  PolicySortKey,

  statusLabels,

} from './dealsView/helpers';

import { TasksTab } from './dealsView/tabs/TasksTab';

import { PoliciesTab } from './dealsView/tabs/PoliciesTab';

import { QuotesTab } from './dealsView/tabs/QuotesTab';

import { FilesTab } from './dealsView/tabs/FilesTab';

import { ChatTab } from './dealsView/tabs/ChatTab';

import { useSelectedDeal } from '../../hooks/useSelectedDeal';



interface DealsViewProps {

  deals: Deal[];

  clients: Client[];

  policies: Policy[];

  payments: Payment[];

  financialRecords: FinancialRecord[];

  tasks: Task[];

  users: User[];

  currentUser: User;

  selectedDealId: string | null;

  onSelectDeal: (dealId: string) => void;

  onUpdateStatus: (dealId: string, status: DealStatus) => Promise<void>;

  onUpdateDeal: (dealId: string, data: EditDealFormValues) => Promise<void>;

  onRequestAddQuote: (dealId: string) => void;

  onRequestEditQuote: (quote: Quote) => void;

  onRequestAddPolicy: (dealId: string) => void;

  onRequestEditPolicy: (policy: Policy) => void;

  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;

  onDeletePolicy: (policyId: string) => Promise<void>;

  onRefreshPolicies?: () => Promise<void>;

  onPolicyDraftReady?: (

    dealId: string,

    parsed: Record<string, unknown>,

    fileName?: string | null

  ) => void;

  onAddPayment: (values: AddPaymentFormValues) => Promise<void>;

  onUpdatePayment: (paymentId: string, values: AddPaymentFormValues) => Promise<void>;

  onAddFinancialRecord: (values: AddFinancialRecordFormValues) => Promise<void>;

  onUpdateFinancialRecord: (

    recordId: string,

    values: AddFinancialRecordFormValues

  ) => Promise<void>;

  onDeleteFinancialRecord: (recordId: string) => Promise<void>;

  onDriveFolderCreated: (dealId: string, folderId: string) => void;

  onFetchChatMessages: (dealId: string) => Promise<ChatMessage[]>;

  onSendChatMessage: (dealId: string, body: string) => Promise<void>;

  onDeleteChatMessage: (messageId: string) => Promise<void>;

  onFetchDealHistory: (dealId: string, includeDeleted?: boolean) => Promise<ActivityLog[]>;

  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;

  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;

  onDeleteTask: (taskId: string) => Promise<void>;

  onDeleteDeal: (dealId: string) => Promise<void>;

  onRestoreDeal: (dealId: string) => Promise<void>;

  onMergeDeals: (targetDealId: string, sourceDealIds: string[], resultingClientId?: string | undefined) => Promise<void>;

  onLoadMoreDeals: () => Promise<void>;

  dealsHasMore: boolean;

  isLoadingMoreDeals: boolean;

  dealSearch: string;

  onDealSearchChange: (value: string) => void;

  dealExecutorFilter: string;

  onDealExecutorFilterChange: (value: string) => void;

  dealSourceFilter: string;

  onDealSourceFilterChange: (value: string) => void;

  dealExpectedCloseFrom: string;

  onDealExpectedCloseFromChange: (value: string) => void;

  dealExpectedCloseTo: string;

  onDealExpectedCloseToChange: (value: string) => void;

  dealShowDeleted: boolean;

  onDealShowDeletedChange: (value: boolean) => void;

}



export const DealsView: React.FC<DealsViewProps> = ({

  deals,

  clients,

  policies,

  payments,

  financialRecords,

  tasks,

  users,

  selectedDealId,

  onSelectDeal,

  onUpdateStatus,

  onUpdateDeal,

  onDeleteDeal,

  onRestoreDeal,

  onMergeDeals,

  onLoadMoreDeals,

  dealsHasMore,

  isLoadingMoreDeals,

  onRequestAddQuote,

  onRequestEditQuote,

  onRequestAddPolicy,

  onRequestEditPolicy,

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

  dealSearch,

  onDealSearchChange,

  dealExecutorFilter,

  onDealExecutorFilterChange,

  dealSourceFilter,

  onDealSourceFilterChange,

  dealExpectedCloseFrom,

  onDealExpectedCloseFromChange,

  dealExpectedCloseTo,

  onDealExpectedCloseToChange,

  dealShowDeleted,

  onDealShowDeletedChange,

  currentUser,

}) => {

  // Сортируем сделки по дате следующего контакта (ближайшие сверху)

  const {

    sortedDeals,

    selectedDeal,

    selectedClient,

    sellerUser,

    executorUser,

  } = useSelectedDeal({ deals, clients, users, selectedDealId });

  const sellerDisplayName = sellerUser

    ? getUserDisplayName(sellerUser)

    : selectedDeal?.sellerName || '—';

  const executorDisplayName = executorUser

    ? getUserDisplayName(executorUser)

    : selectedDeal?.executorName || '—';

  const headerExpectedCloseTone = getDeadlineTone(selectedDeal?.expectedClose);

  const isSelectedDealDeleted = Boolean(selectedDeal?.deletedAt);



  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  const [mergeSources, setMergeSources] = useState<string[]>([]);

  const [mergeError, setMergeError] = useState<string | null>(null);

  const [isMerging, setIsMerging] = useState(false);

  const [mergeResultingClientId, setMergeResultingClientId] = useState<string | undefined>(undefined);

  const mergeCandidates = useMemo(() => {

    if (!selectedDeal) {

      return [];

    }

    return deals.filter((deal) => deal.id !== selectedDeal.id && !deal.deletedAt);

  }, [deals, selectedDeal]);

  const mergeClientOptions = useMemo(() => {

    if (!selectedDeal) {

      return [];

    }

    const ids = new Set<string>();

    if (selectedDeal.clientId) {

      ids.add(selectedDeal.clientId);

    }

    mergeCandidates.forEach((deal) => {

      if (deal.clientId) {

        ids.add(deal.clientId);

      }

    });

    return Array.from(ids).map((clientId) => {

      const client = clients.find((entity) => entity.id === clientId);

      const fallbackName =

        mergeCandidates.find((deal) => deal.clientId === clientId)?.clientName ||

        selectedDeal.clientName;

      const name = client?.name || fallbackName || '—';

      return { id: clientId, name };

    });

  }, [clients, mergeCandidates, selectedDeal]);

  useEffect(() => {

    if (!isMergeModalOpen) {

      setMergeResultingClientId(undefined);

      return;

    }

    if (!mergeClientOptions.length) {

      setMergeResultingClientId(undefined);

      return;

    }

    setMergeResultingClientId((prev) => {

      if (prev && mergeClientOptions.some((option) => option.id === prev)) {

        return prev;

      }

      return mergeClientOptions[0].id;

    });

  }, [isMergeModalOpen, mergeClientOptions]);



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

  const [savingDateField, setSavingDateField] = useState<

    'nextContactDate' | 'expectedClose' | null

  >(null);

  const [policySortKey] = useState<PolicySortKey>('startDate');

  const [policySortOrder] = useState<'asc' | 'desc'>('asc');

  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);

  const [isDriveLoading, setIsDriveLoading] = useState(false);

  const [driveError, setDriveError] = useState<string | null>(null);

  const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<string[]>([]);

  const [isRecognizing, setRecognizing] = useState(false);

  const [recognitionResults, setRecognitionResults] = useState<PolicyRecognitionResult[]>([]);

  const [recognitionMessage, setRecognitionMessage] = useState<string | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);

  const [notesLoading, setNotesLoading] = useState(false);

  const [notesFilter, setNotesFilter] = useState<'active' | 'archived'>('active');

  const [noteDraft, setNoteDraft] = useState('');

  const [notesError, setNotesError] = useState<string | null>(null);

  const [notesAction, setNotesAction] = useState<string | null>(null);



  useEffect(() => {

    setActiveTab('overview');

  }, [selectedDeal?.id]);



  useEffect(() => {

    setSelectedDriveFileIds([]);

    setRecognitionResults([]);

    setRecognitionMessage(null);

  }, [selectedDeal?.id]);



  useEffect(() => {

    if (!isMergeModalOpen) {

      setMergeSources([]);

      setMergeError(null);

    }

  }, [isMergeModalOpen]);



  useEffect(() => {

    setMergeSources([]);

    setMergeError(null);

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

    async (body: string) => {

      const dealId = selectedDeal?.id;

      if (!dealId) {

        return;

      }

      await onSendChatMessage(dealId, body);

      await loadChatMessages();

    },

    [onSendChatMessage, selectedDeal?.id, loadChatMessages]

  );



  const handleChatDelete = useCallback(

    async (messageId: string) => {

      const dealId = selectedDeal?.id;

      if (!dealId) {

        return;

      }

      await onDeleteChatMessage(messageId);

      await loadChatMessages();

    },

    [onDeleteChatMessage, loadChatMessages, selectedDeal?.id]

  );



  const toggleMergeSource = useCallback((dealId: string) => {

    setMergeSources((prev) =>

      prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [...prev, dealId]

    );

    setMergeError(null);

  }, []);



  const handleResultingClientChange = useCallback((event: React.ChangeEvent<HTMLSelectElement>) => {

    setMergeResultingClientId(event.target.value || undefined);

  }, []);



  const handleMergeSubmit = useCallback(async () => {

    if (!selectedDeal) {

      return;

    }

    if (!mergeSources.length) {

      setMergeError('Выберите сделки для объединения.');

      return;

    }

    if (mergeClientOptions.length && !mergeResultingClientId) {

      setMergeError('Выберите клиента для объединённой сделки.');

      return;

    }

    setIsMerging(true);

    setMergeError(null);

    try {

      await onMergeDeals(selectedDeal.id, mergeSources, mergeResultingClientId);

      setIsMergeModalOpen(false);

    } catch (err) {

      setMergeError(err instanceof Error ? err.message : 'Во время объединения произошла ошибка.');

    } finally {

      setIsMerging(false);

    }

  }, [mergeClientOptions.length, mergeResultingClientId, mergeSources, onMergeDeals, selectedDeal]);



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



  const handleInlineDateChange = async (

    field: 'nextContactDate' | 'expectedClose',

    rawValue: string,

    options?: { selectTopDeal?: boolean }

  ) => {

    if (!selectedDeal) return;

    const value = rawValue || null;



    const payload: EditDealFormValues = {

      title: selectedDeal.title,

      description: selectedDeal.description || '',

      clientId: selectedDeal.clientId,

      source: selectedDeal.source ?? null,

      nextContactDate: field === 'nextContactDate' ? value : selectedDeal.nextContactDate ?? null,

      expectedClose: field === 'expectedClose' ? value : selectedDeal.expectedClose ?? null,

    };



    setSavingDateField(field);

    try {

      await onUpdateDeal(selectedDeal.id, payload);

      if (options?.selectTopDeal) {

        const topDeal = sortedDeals[0];

        if (topDeal && topDeal.id !== selectedDeal.id) {

          onSelectDeal(topDeal.id);

        }

      }

    } catch (err) {

      console.error('Ошибка обновления даты сделки:', err);

    } finally {

      setSavingDateField(null);

    }

  };



  const handleQuickNextContact = async (days: number) => {

    await handleInlineDateChange('nextContactDate', getDatePlusDays(days), {

      selectTopDeal: true,

    });

  };



  const handleAddNote = async () => {

    if (!selectedDeal) {

      return;

    }

    const trimmed = noteDraft.trim();

    if (!trimmed) {

      return;

    }



    setNotesAction('create');

    setNotesError(null);

    try {

      await createNote(selectedDeal.id, trimmed);

      setNoteDraft('');

      await loadNotes(notesFilter);

    } catch (err) {

      console.error('Ошибка создания заметки:', err);

      setNotesError(

        err instanceof Error ? err.message : 'Не удалось создать заметку'

      );

    } finally {

      setNotesAction(null);

    }

  };



  const handleArchiveNote = async (noteId: string) => {

    setNotesAction(noteId);

    setNotesError(null);

    try {

      await archiveNote(noteId);

      await loadNotes(notesFilter);

    } catch (err) {

      console.error('Ошибка удаления заметки:', err);

      setNotesError(

        err instanceof Error

          ? err.message

          : 'Не удалось удалить заметку'

      );

    } finally {

      setNotesAction(null);

    }

  };



  const handleRestoreNote = async (noteId: string) => {

    setNotesAction(noteId);

    setNotesError(null);

    try {

      await restoreNote(noteId);

      setNotesFilter('active');

    } catch (err) {

      console.error('Ошибка восстановления заметки:', err);

      setNotesError(

        err instanceof Error ? err.message : 'Не удалось восстановить заметку'

      );

    } finally {

      setNotesAction(null);

    }

  };



  const loadDriveFiles = useCallback(async () => {

    if (!selectedDeal) {

      setDriveFiles([]);

      setDriveError(null);

      return;

    }



    setIsDriveLoading(true);

    try {

      const includeDeleted = Boolean(selectedDeal.deletedAt);

      const { files, folderId } = await fetchDealDriveFiles(selectedDeal.id, includeDeleted);

      setDriveFiles(files);

      setDriveError(null);

      if (folderId && folderId !== selectedDeal.driveFolderId) {

        onDriveFolderCreated(selectedDeal.id, folderId);

      }

    } catch (err) {

      console.error('Ошибка загрузки файлов Google Drive:', err);

      setDriveFiles([]);

      setDriveError(

        err instanceof Error

          ? err.message

          : 'Не удалось загрузить файлы из Google Drive.'

      );

    } finally {

      setIsDriveLoading(false);

    }

  }, [selectedDeal, onDriveFolderCreated]);



  const handleDriveFileUpload = useCallback(

    async (file: File) => {

      if (!selectedDeal) {

        return;

      }

      await uploadDealDriveFile(selectedDeal.id, file, isSelectedDealDeleted);

    },

    [selectedDeal, isSelectedDealDeleted]

  );



  useEffect(() => {

    if (activeTab === 'files') {

      void loadDriveFiles();

      return;

    }



    setDriveFiles([]);

    setDriveError(null);

  }, [activeTab, loadDriveFiles]);



  const toggleDriveFileSelection = useCallback((fileId: string) => {

    setSelectedDriveFileIds((prev) =>

      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]

    );

  }, []);



  const handleRecognizePolicies = useCallback(async () => {

    if (!selectedDeal) {

      return;

    }

    if (!selectedDriveFileIds.length) {

      setRecognitionMessage('Выберите хотя бы один файл для распознавания.');

      return;

    }

    setRecognizing(true);

    setRecognitionMessage(null);

    try {

      const { results } = await recognizeDealPolicies(

        selectedDeal.id,

        selectedDriveFileIds

      );

      setRecognitionResults(results);

      const parsed = results.find((result) => result.status === 'parsed' && result.data);

      if (parsed && onPolicyDraftReady) {

        onPolicyDraftReady(selectedDeal.id, parsed.data!, parsed.fileName ?? null);

      }

      if (onRefreshPolicies) {

        await onRefreshPolicies();

      }

    } catch (error) {

      console.error('Ошибка распознавания полисов:', error);

      setRecognitionMessage(

        error instanceof Error

          ? error.message

          : 'Не удалось распознать полисы. Попробуйте позже.'

      );

    } finally {

      setRecognizing(false);

    }

  }, [

    onRefreshPolicies,

    onPolicyDraftReady,

    selectedDeal,

    selectedDriveFileIds,

  ]);



  const loadNotes = useCallback(

    async (filter: 'active' | 'archived') => {

      const dealId = selectedDeal?.id;

      if (!dealId) {

        setNotes([]);

        return;

      }

      setNotesLoading(true);

      setNotesError(null);

      try {

        const fetchedNotes = await fetchDealNotes(dealId, filter === 'archived');

        setNotes(fetchedNotes);

      } catch (err) {

        console.error('Ошибка загрузки заметок:', err);

        setNotesError(err instanceof Error ? err.message : 'Не удалось загрузить заметки');

      } finally {

        setNotesLoading(false);

      }

    },

    [selectedDeal?.id]

  );



  useEffect(() => {

    if (!selectedDeal?.id) {

      setNotes([]);

      return;

    }

    void loadNotes(notesFilter);

  }, [selectedDeal?.id, loadNotes, notesFilter]);



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



  const quotes = selectedDeal?.quotes ?? [];



  const displayedTasks = useMemo(() => {

    const active = relatedTasks.filter((task) => task.status !== 'done');

    const done = relatedTasks.filter((task) => task.status === 'done');

    return [...active, ...done];

  }, [relatedTasks]);



  const sortedDriveFiles = useMemo(() => {

    return [...driveFiles].sort((a, b) => {

      if (a.isFolder !== b.isFolder) {

        return a.isFolder ? -1 : 1;

      }

      return a.name.localeCompare(b.name, 'ru-RU', { sensitivity: 'base' });

    });

  }, [driveFiles]);



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

      isRecognizing={isRecognizing}

      recognitionResults={recognitionResults}

      recognitionMessage={recognitionMessage}

      driveError={driveError}

      sortedDriveFiles={sortedDriveFiles}

    />

  );



  const renderNotesSection = () => {
    if (!selectedDeal) {
      return null;
    }
    const filterOptions: { value: 'active' | 'archived'; label: string }[] = [
      { value: 'active', label: '????????' },
      { value: 'archived', label: '???????? ????????' },
    ];
    return (
      <section className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-slate-700">?????? ???????????? ??????</p>
            <select
              value={mergeResultingClientId ?? ""}
              onChange={handleResultingClientChange}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:outline-none"
              disabled={!mergeClientOptions.length}
            >
              {mergeClientOptions.length ? (
                mergeClientOptions.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))
              ) : (
                <option value="">??? ????????? ????????</option>
              )}
            </select>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-700">??????, ??????? ????? ??????????</p>
            {mergeCandidates.length ? (
              mergeCandidates.map((deal) => {
                const clientName =
                  clients.find((client) => client.id === deal.clientId)?.name ??
                  deal.clientName ??
                  "?";
                return (
                  <label
                    key={deal.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 hover:border-slate-300"
                  >
                    <input
                      type="checkbox"
                      checked={mergeSources.includes(deal.id)}
                      onChange={() => toggleMergeSource(deal.id)}
                      className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
                      <p className="text-[11px] text-slate-500">
                        ??????: {clientName} ? ??????: {deal.stageName || "?"} ??????????: {statusLabels[deal.status]}
                      </p>
                    </div>
                  </label>
                );
              })
            ) : (
              <p className="text-sm text-slate-500">?????? ??? ??????????? ???? ???.</p>
            )}
          </div>
        </div>
        {mergeError && (
          <p className="text-sm font-medium text-rose-600">{mergeError}</p>
        )}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
          <button
            type="button"
            onClick={() => setIsMergeModalOpen(false)}
            className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200"
          >
            ������
          </button>
          <button
            type="button"
            onClick={handleMergeSubmit}
            disabled={isMerging || !mergeSources.length}
            className="px-3 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isMerging ? '����������...' : '���������� ������'}
          </button>
        </div>
      </section>
    );
  };


