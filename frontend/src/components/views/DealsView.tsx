import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {

  ActivityLog,

  ChatMessage,

  Client,

  Deal,

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

  fetchDeals,

} from '../../api';

import { ActivityTimeline } from '../ActivityTimeline';

import { EditDealForm, EditDealFormValues } from '../forms/EditDealForm';

import { AddTaskForm, AddTaskFormValues } from '../forms/AddTaskForm';

import { AddPaymentForm, AddPaymentFormValues } from '../forms/AddPaymentForm';

import {

  AddFinancialRecordForm,

  AddFinancialRecordFormValues,

} from '../forms/AddFinancialRecordForm';

import { ColoredLabel } from '../common/ColoredLabel';

import {

  DEAL_TABS,

  DealTabId,

  FinancialRecordCreationContext,

  formatDate,

  formatDeletedAt,


  getDeadlineTone,

  getPolicySortValue,

  getUserDisplayName,


  PolicySortKey,

  closedDealStatuses,

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

  currentUser: User | null;

  selectedDealId: string | null;

  onSelectDeal: (dealId: string) => void;

  onCloseDeal: (dealId: string, payload: { reason: string; status?: 'won' | 'lost' }) => Promise<void>;

  onReopenDeal: (dealId: string) => Promise<void>;

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

  onCloseDeal,

  onReopenDeal,

  onUpdateDeal,
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

  onDeleteDeal,

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



  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);

  const [mergeSources, setMergeSources] = useState<string[]>([]);

  const [mergeError, setMergeError] = useState<string | null>(null);

  const [isMerging, setIsMerging] = useState(false);

  const [isDeletingDeal, setIsDeletingDeal] = useState(false);
  const [isClosingDeal, setIsClosingDeal] = useState(false);
  const [isReopeningDeal, setIsReopeningDeal] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeSearchResults, setMergeSearchResults] = useState<Deal[]>([]);
  const [isMergeSearchLoading, setIsMergeSearchLoading] = useState(false);

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

  const [policySortKey] = useState<PolicySortKey>('startDate');

  const [policySortOrder] = useState<'asc' | 'desc'>('asc');

  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);

  const [isDriveLoading, setIsDriveLoading] = useState(false);

  const [driveError, setDriveError] = useState<string | null>(null);

  const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<string[]>([]);

  const selectedDriveFiles = useMemo(
    () =>
      selectedDriveFileIds
        .map((id) => driveFiles.find((file) => file.id === id))
        .filter((file): file is DriveFile => Boolean(file)),
    [driveFiles, selectedDriveFileIds]
  );

  const canRecognizeSelectedFiles =
    selectedDriveFileIds.length > 0 &&
    selectedDriveFiles.length === selectedDriveFileIds.length &&
    selectedDriveFiles.every(
      (file) => file.mimeType?.toLowerCase() === 'application/pdf'
    );

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

      setMergeSearch('');

      setMergeSearchResults([]);

      setIsMergeSearchLoading(false);

    }

  }, [isMergeModalOpen]);



  useEffect(() => {

    setMergeSources([]);

    setMergeError(null);

    setMergeSearch('');

    setMergeSearchResults([]);

    setIsMergeSearchLoading(false);

  }, [selectedDeal?.id]);



  const mergeQuery = mergeSearch.trim();

  useEffect(() => {

    if (!mergeQuery) {

      setMergeSearchResults([]);

      setIsMergeSearchLoading(false);

      return;

    }



    let isCancelled = false;



    setIsMergeSearchLoading(true);



    const handler = setTimeout(() => {

      (async () => {

        try {

          const filters: Record<string, unknown> = {

            search: mergeQuery,

            page_size: 50,

          };

          if (currentUser?.id) {

            filters.seller = currentUser.id;

          }

          const results = await fetchDeals(filters);

          if (isCancelled) {

            return;

          }

          const filtered = results.filter(

            (deal) => deal.id !== selectedDeal?.id && !deal.deletedAt

          );

          setMergeSearchResults(filtered);

        } catch (err) {

          if (!isCancelled) {

            console.error('Ошибка поиска сделок для объединения:', err);

            setMergeSearchResults([]);

          }

        } finally {

          if (!isCancelled) {

            setIsMergeSearchLoading(false);

          }

        }

      })();

    }, 300);



    return () => {

      isCancelled = true;

      clearTimeout(handler);

    };

  }, [currentUser?.id, mergeQuery, selectedDeal?.id]);



  const isMergeSearchActive = Boolean(mergeQuery);

  const mergeList = isMergeSearchActive ? mergeSearchResults : mergeCandidates;



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

    setIsMergeModalOpen(true);
  }, [isSelectedDealDeleted, selectedDeal]);



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

    }

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

    if (!canRecognizeSelectedFiles) {

      setRecognitionMessage('Можно распознавать только PDF-файлы.');

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

    canRecognizeSelectedFiles,

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

      canRecognizeSelectedFiles={canRecognizeSelectedFiles}

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
      { value: 'active', label: 'Активные' },
      { value: 'archived', label: 'Показать удаленные заметки' },
    ];

    return (
      <section className="space-y-6">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={notesLoading}
                onClick={() => setNotesFilter(option.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  notesFilter === option.value
                    ? 'bg-slate-900 text-white border border-slate-900'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          {notesError && <p className="text-xs text-rose-500">{notesError}</p>}
          {notesFilter === 'active' && (
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
              <textarea
                rows={4}
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Заметка к сделке"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-inner focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-400">Все заметки видны всем участникам</p>
                <button
                  type="button"
                  onClick={handleAddNote}
                  disabled={notesAction === 'create'}
                  className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {notesAction === 'create' ? 'Сохраняем...' : 'Добавить заметку'}
                </button>
              </div>
            </div>
          )}
        </div>

        {notesLoading ? (
          <p className="text-sm text-slate-500">Загрузка заметок...</p>
        ) : notes.length ? (
          <div className="columns-1 gap-4 space-y-4 sm:columns-2 xl:columns-3 2xl:columns-4">
            {notes.map((note) => (
              <article
                key={note.id}
                className="relative mb-4 overflow-hidden rounded-[28px] border border-amber-200 bg-amber-50 p-4 pb-5 text-slate-900 shadow-[0_20px_40px_rgba(245,158,11,0.25)] transition hover:-translate-y-1 break-inside-avoid-column"
              >
                <div className="absolute top-2 right-4 h-3 w-12 rounded-full bg-amber-300 opacity-80 shadow-[0_4px_15px_rgba(245,158,11,0.5)]" />
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  <ColoredLabel
                    value={note.authorName}
                    fallback="—"
                    showDot={false}
                    className="text-[11px] uppercase tracking-[0.3em]"
                  />
                </p>
                <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-900">
                  {note.body || '—'}
                </p>
                <div className="mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                  <span className="text-[11px] font-normal text-slate-500">
                    {formatDate(note.createdAt)}
                  </span>
                  {notesFilter === 'active' ? (
                    <button
                      type="button"
                      disabled={notesAction === note.id}
                      onClick={() => handleArchiveNote(note.id)}
                      className="text-[11px] font-semibold text-slate-700 transition hover:text-slate-900 disabled:text-slate-400"
                    >
                      {notesAction === note.id ? 'Удаляем...' : 'Удалить'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={notesAction === note.id}
                      onClick={() => handleRestoreNote(note.id)}
                      className="text-[11px] font-semibold text-slate-700 transition hover:text-slate-900 disabled:text-slate-400"
                    >
                      {notesAction === note.id ? 'Сохраняем...' : 'Восстановить'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white/60 p-6 text-sm text-slate-500">
            {notesFilter === 'active'
              ? 'Заметок пока нет — добавьте первую, чтобы зафиксировать важное.'
              : 'Удаленные заметки пусты — вы еще не удаляли заметки.'}
          </div>
        )}
      </section>
    );
  };

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

  const renderHeaderDates = () => {
    if (!selectedDeal) {
      return null;
    }

    return (
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400">Следующий контакт</p>
          <input
            type="date"
            value={selectedDeal.nextContactDate ?? ''}
            onChange={(event) => handleInlineDateChange('nextContactDate', event.target.value)}
            className="mt-1 max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:ring focus:ring-sky-100"
          />
        </div>
        <div>
          <p className={`text-xs uppercase tracking-wide ${headerExpectedCloseTone}`}>
            Застраховать не позднее чем
          </p>
          <input
            type="date"
            value={selectedDeal.expectedClose ?? ''}
            onChange={(event) => handleInlineDateChange('expectedClose', event.target.value)}
            className="mt-1 max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:ring focus:ring-sky-100"
          />
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': {
        return (
          <div className="space-y-6">
            {renderNotesSection()}
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

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 h-full">
      <section className="xl:col-span-1 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Сделки</p>
            <p className="text-lg font-semibold text-slate-900">{sortedDeals.length}</p>
          </div>
        </div>
        <div className="px-5 py-3 border-b border-slate-100 space-y-3">
          <div>
            <label htmlFor="dealSearch" className="text-xs font-semibold text-slate-500 mb-1 block">
              Поиск
            </label>
            <input
              id="dealSearch"
              type="search"
              value={dealSearch}
              onChange={(event) => onDealSearchChange(event.target.value)}
              placeholder="Поиск по сделкам"
              className="h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring focus:ring-sky-100 focus:ring-offset-0"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="dealExecutor" className="text-xs font-semibold text-slate-500 mb-1 block">
                Ответственный
              </label>
              <select
                id="dealExecutor"
                value={dealExecutorFilter}
                onChange={(event) => onDealExecutorFilterChange(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring focus:ring-sky-100 focus:ring-offset-0"
              >
                <option value="">Все</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {getUserDisplayName(user)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="dealSource" className="text-xs font-semibold text-slate-500 mb-1 block">
                Источник
              </label>
              <input
                id="dealSource"
                type="text"
                value={dealSourceFilter}
                onChange={(event) => onDealSourceFilterChange(event.target.value)}
                placeholder="Например, реклама, рефералы"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring focus:ring-sky-100 focus:ring-offset-0"
              />
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label htmlFor="dealExpectedCloseFrom" className="text-xs font-semibold text-slate-500 mb-1 block">
                Дата закрытия с
              </label>
              <input
                id="dealExpectedCloseFrom"
                type="date"
                value={dealExpectedCloseFrom}
                onChange={(event) => onDealExpectedCloseFromChange(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring focus:ring-sky-100 focus:ring-offset-0"
              />
            </div>
            <div>
              <label htmlFor="dealExpectedCloseTo" className="text-xs font-semibold text-slate-500 mb-1 block">
                Дата закрытия по
              </label>
              <input
                id="dealExpectedCloseTo"
                type="date"
                value={dealExpectedCloseTo}
                onChange={(event) => onDealExpectedCloseToChange(event.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring focus:ring-sky-100 focus:ring-offset-0"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="dealShowDeleted"
              type="checkbox"
              checked={dealShowDeleted}
              onChange={(event) => onDealShowDeletedChange(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="dealShowDeleted" className="text-xs font-semibold text-slate-500">
              Показать удалённые сделки
            </label>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sortedDeals.map((deal) => {
            const isOverdue = deal.nextContactDate ? new Date(deal.nextContactDate) < new Date() : false;
            const deadlineTone = getDeadlineTone(deal.expectedClose);
            const isDeleted = Boolean(deal.deletedAt);
            return (
              <button
                key={deal.id}
                onClick={() => onSelectDeal(deal.id)}
                className={`w-full text-left px-5 py-4 border-b border-slate-100 transition ${
                  selectedDeal?.id === deal.id ? 'bg-sky-50' : 'hover:bg-slate-50'
                } ${isDeleted ? 'opacity-60' : ''}`}
              >
                <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
                <p className="text-xs text-slate-500 mt-1">{statusLabels[deal.status]}</p>
                {isDeleted && (
                  <p className="text-[11px] font-semibold text-rose-500 mt-1">
                    Удалена: {formatDeletedAt(deal.deletedAt)}
                  </p>
                )}
                <p className="text-xs text-slate-400 mt-1">Клиент: {deal.clientName || '-'}</p>
                {deal.expectedClose ? (
                  <p className={`text-xs mt-1 ${deadlineTone}`}>
                    Застраховать не позднее чем: {formatDate(deal.expectedClose)}
                  </p>
                ) : (
                  <p className="text-xs mt-1 text-rose-500 font-semibold">
                    Заполните дату, чтобы не пропустить сроки
                  </p>
                )}
                <div className="text-xs text-slate-500 mt-2 flex items-center justify-between">
                  <span>Контакт: {formatDate(deal.nextContactDate)}</span>
                  {deal.nextContactDate && (
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        isOverdue ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {isOverdue ? '⚠ ' : ''}
                      {formatDate(deal.nextContactDate)}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
          {dealsHasMore && (
            <div className="px-5 py-4 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onLoadMoreDeals}
                disabled={isLoadingMoreDeals}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:text-slate-400 disabled:hover:text-slate-400"
              >
                {isLoadingMoreDeals ? 'Загрузка...' : 'Показать ещё'}
              </button>
            </div>
          )}
        </div>
      </section>
      <section className="xl:col-span-3 space-y-6">
        {selectedDeal ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm text-slate-500">Клиент</p>
                <p className="text-xl font-semibold text-slate-900">{selectedClient?.name || selectedDeal.clientName || '-'}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Ответственный: <ColoredLabel value={sellerDisplayName !== '—' ? sellerDisplayName : undefined} fallback="—" showDot={false} className="text-slate-900 font-semibold" /> · Исполнитель: <ColoredLabel value={executorDisplayName !== '—' ? executorDisplayName : undefined} fallback="—" showDot={false} className="text-slate-900 font-semibold" />
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-900">
                  {statusLabels[selectedDeal.status]}
                </span>
                <span className={`text-sm font-semibold ${headerExpectedCloseTone}`}>
                  {selectedDeal.expectedClose ? formatDate(selectedDeal.expectedClose) : 'Нет срока'}
                </span>
              </div>
              {selectedDeal.closingReason && (
                <p className="text-xs text-slate-500 mt-2">
                  Причина закрытия: {selectedDeal.closingReason}
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleEditDealClick}
                disabled={isSelectedDealDeleted}
                className="px-4 py-1.5 text-sm font-semibold rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Редактировать
              </button>
              <button
                type="button"
                onClick={handleDeleteDealClick}
                disabled={isSelectedDealDeleted || isDeletingDeal}
                className="px-4 py-1.5 text-sm font-semibold rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeletingDeal ? 'Удаляем...' : 'Удалить'}
              </button>
              <button
                type="button"
                onClick={handleCloseDealClick}
                disabled={
                  isSelectedDealDeleted ||
                  isDealClosedStatus ||
                  isClosingDeal ||
                  !isCurrentUserSeller
                }
                className="px-4 py-1.5 text-sm font-semibold rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isClosingDeal ? 'Закрываем...' : 'Закрыть'}
              </button>
              {isDealClosedStatus && (
                <button
                  type="button"
                  onClick={handleReopenDealClick}
                  disabled={
                    isSelectedDealDeleted || !canReopenClosedDeal || isReopeningDeal
                  }
                  className="px-4 py-1.5 text-sm font-semibold rounded-full bg-amber-600 text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isReopeningDeal ? 'Восстанавливаем...' : 'Восстановить'}
                </button>
              )}
              <button
                type="button"
                onClick={handleMergeClick}
                disabled={isSelectedDealDeleted}
                className="px-4 py-1.5 text-sm font-semibold rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Сцепить
              </button>
            </div>
            {renderHeaderDates()}
            <div>
              <div className="flex flex-wrap gap-2 border-b border-slate-200">
                {DEAL_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                      activeTab === tab.id
                        ? 'bg-white text-sky-600 border border-b-white border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="pt-6">{renderTabContent()}</div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-sm text-slate-500">
            Выберите сделку, чтобы увидеть подробности.
          </div>
        )}
      </section>
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
            <div className="p-6">
              <EditDealForm
                deal={selectedDeal}
                clients={clients}
                users={users}
                onSubmit={async (data) => {
                  await onUpdateDeal(selectedDeal.id, data);
                  setIsEditingDeal(false);
                }}
                onCancel={() => setIsEditingDeal(false)}
              />
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
      {isMergeModalOpen && selectedDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-slate-900">Объединить сделки</h3>
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Целевая сделка</p>
                <p className="text-base font-semibold text-slate-900">{selectedDeal.title}</p>
                <p className="text-xs text-slate-500">
                  Клиент: {selectedClient?.name || selectedDeal.clientName || '—'}
                </p>
              </div>
              <div className="space-y-3">
                <p className="text-sm font-semibold text-slate-700">Выберите сделки для переноса</p>
                <input
                  type="search"
                  value={mergeSearch}
                  onChange={(event) => setMergeSearch(event.target.value)}
                  placeholder="Поиск по названию сделки"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-500 focus:outline-none focus:ring focus:ring-sky-100"
                />
                {mergeList.length ? (
                  mergeList.map((deal) => (
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
                          Стадия: {deal.stageName || '—'} · Статус: {statusLabels[deal.status]}
                        </p>
                      </div>
                    </label>
                  ))
                ) : (
                  !isMergeSearchLoading && (
                    <p className="text-sm text-slate-500">
                      {isMergeSearchActive
                        ? `По запросу "${mergeQuery}" ничего не найдено.`
                        : 'Нет других активных сделок у клиента.'}
                    </p>
                  )
                )}
                {isMergeSearchLoading && (
                  <p className="text-sm text-slate-500">Поиск...</p>
                )}
              </div>
              {mergeError && (
                <p className="text-sm font-medium text-rose-600">{mergeError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                type="button"
                onClick={() => setIsMergeModalOpen(false)}
                className="px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg border border-slate-200"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleMergeSubmit}
                disabled={isMerging || !mergeSources.length}
                className="px-3 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isMerging ? 'Объединяем...' : 'Объединить сделки'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
