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
} from '../../api';
import { FileUploadManager } from '../FileUploadManager';
import { ChatBox } from '../ChatBox';
import { ActivityTimeline } from '../ActivityTimeline';
import { EditDealForm, EditDealFormValues } from '../forms/EditDealForm';
import { AddTaskForm, AddTaskFormValues } from '../forms/AddTaskForm';
import { AddPaymentForm, AddPaymentFormValues } from '../forms/AddPaymentForm';
import {
  AddFinancialRecordForm,
  AddFinancialRecordFormValues,
} from '../forms/AddFinancialRecordForm';

const statusLabels: Record<DealStatus, string> = {
  open: 'В работе',
  won: 'Выиграна',
  lost: 'Закрыта (проиграна)',
  on_hold: 'На паузе',
};

const DEAL_TABS = [
  { id: 'overview', label: 'Обзор' },
  { id: 'tasks', label: 'Задачи' },
  { id: 'quotes', label: 'Расчеты' },
  { id: 'policies', label: 'Полисы' },
  { id: 'payments', label: 'Платежи' },
  { id: 'chat', label: 'Чат' },
  { id: 'files', label: 'Файлы' },
  { id: 'notes', label: 'Заметки' },
  { id: 'history', label: 'История' },
] as const;

type DealTabId = (typeof DEAL_TABS)[number]['id'];

type FinancialRecordCreationContext = {
  paymentId: string;
  recordType: 'income' | 'expense';
};

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('ru-RU') : '—';

const QUICK_NEXT_CONTACT_OPTIONS = [
  { label: 'Завтра', days: 1 },
  { label: 'Через 2 дня', days: 2 },
  { label: 'Через 5 дней', days: 5 },
] as const;


const getDatePlusDays = (days: number) => {
  const target = new Date();
  target.setDate(target.getDate() + days);
  const year = target.getFullYear();
  const month = String(target.getMonth() + 1).padStart(2, '0');
  const day = String(target.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDeadlineTone = (value?: string | null) => {
  if (!value) {
    return 'text-slate-400';
  }
  const today = new Date();
  const deadline = new Date(value);
  const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return 'text-red-700';
  }
  if (diffDays <= 3) {
    return 'text-red-600';
  }
  if (diffDays <= 7) {
    return 'text-orange-600';
  }
  if (diffDays <= 14) {
    return 'text-orange-500';
  }
  return 'text-slate-500';
};

const formatCurrency = (value?: string) => {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' });
};

const formatDriveDate = (value?: string | null) =>
  value ? new Date(value).toLocaleString('ru-RU') : '—';

const formatDriveFileSize = (bytes?: number | null) => {
  if (bytes === undefined || bytes === null) {
    return '—';
  }
  if (bytes === 0) {
    return '0 Б';
  }
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(
    Math.floor(Math.log(bytes) / Math.log(k)),
    sizes.length - 1
  );
  return `${(bytes / Math.pow(k, i)).toFixed(1).replace(/\.0$/, '')} ${sizes[i]}`;
};

const getDriveItemIcon = (isFolder: boolean) => (isFolder ? '📁' : '📄');

type PolicySortKey =
  | 'number'
  | 'insuranceCompany'
  | 'insuranceType'
  | 'client'
  | 'startDate'
  | 'endDate'
  | 'transport';

const getPolicyTransportSummary = (policy: Policy) =>
  policy.isVehicle
    ? `${policy.brand || '—'} / ${policy.model || '—'} / ${policy.vin || '—'}`
    : 'Не транспортное';

const getPolicySortValue = (policy: Policy, key: PolicySortKey) => {
  switch (key) {
    case 'number':
      return policy.number ?? '';
    case 'insuranceCompany':
      return policy.insuranceCompany ?? '';
    case 'insuranceType':
      return policy.insuranceType ?? '';
    case 'client':
      return policy.clientName ?? policy.clientId ?? '';
    case 'startDate':
      return policy.startDate ? new Date(policy.startDate).getTime() : 0;
    case 'endDate':
      return policy.endDate ? new Date(policy.endDate).getTime() : 0;
    case 'transport':
      return getPolicyTransportSummary(policy);
    default:
      return '';
  }
};

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
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
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
  onFetchDealHistory: (dealId: string) => Promise<ActivityLog[]>;
  onCreateTask: (dealId: string, data: AddTaskFormValues) => Promise<void>;
  onUpdateTask: (taskId: string, data: Partial<AddTaskFormValues>) => Promise<void>;
  onDeleteTask: (taskId: string) => Promise<void>;
  dealSearch: string;
  onDealSearchChange: (value: string) => void;
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
  onRequestAddQuote,
  onRequestEditQuote,
  onRequestAddPolicy,
  onDeleteQuote,
  onDeletePolicy,
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
  currentUser,
}) => {
  // Сортируем сделки по дате следующего контакта (ближайшие сверху)
  const sortedDeals = useMemo(() => {
    return [...deals].sort((a, b) => {
      const dateA = a.nextContactDate ? new Date(a.nextContactDate).getTime() : Infinity;
      const dateB = b.nextContactDate ? new Date(b.nextContactDate).getTime() : Infinity;
      return dateA - dateB;
    });
  }, [deals]);

  const selectedDeal = selectedDealId
    ? (sortedDeals.find((deal) => deal.id === selectedDealId) ?? null)
    : (sortedDeals[0] ?? null);
  const selectedClient = selectedDeal
    ? (clients.find((client) => client.id === selectedDeal.clientId) ?? null)
    : null;

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
  const [policySortKey, setPolicySortKey] = useState<PolicySortKey>('startDate');
  const [policySortOrder, setPolicySortOrder] = useState<'asc' | 'desc'>('asc');
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesFilter, setNotesFilter] = useState<'active' | 'archived'>('active');
  const [noteDraft, setNoteDraft] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesAction, setNotesAction] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab('overview');
  }, [selectedDeal?.id]);

  // Загружать сообщения когда открываем вкладку "Чат"
  useEffect(() => {
    if (activeTab === 'chat' && selectedDeal) {
      loadChatMessages();
    }
  }, [activeTab, selectedDeal?.id]);

  // Загружать логи активности когда открываем вкладку "История"
  useEffect(() => {
    if (activeTab === 'history' && selectedDeal) {
      loadActivityLogs();
    }
  }, [activeTab, selectedDeal?.id]);

  const loadChatMessages = async () => {
    if (!selectedDeal) return;
    setIsChatLoading(true);
    try {
      const messages = await onFetchChatMessages(selectedDeal.id);
      setChatMessages(messages);
    } catch (err) {
      console.error('Ошибка загрузки сообщений:', err);
    } finally {
      setIsChatLoading(false);
    }
  };

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

  const loadActivityLogs = async () => {
    if (!selectedDeal) return;
    setIsActivityLoading(true);
    try {
      const logs = await onFetchDealHistory(selectedDeal.id);
      setActivityLogs(logs);
    } catch (err) {
      console.error('Ошибка загрузки логов активности:', err);
    } finally {
      setIsActivityLoading(false);
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
      setNotesFilter('archived');
    } catch (err) {
      console.error('Ошибка отправки заметки в архив:', err);
      setNotesError(
        err instanceof Error
          ? err.message
          : 'Не удалось переместить заметку в архив'
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

  const handlePolicySort = (key: PolicySortKey) => {
    if (policySortKey === key) {
      setPolicySortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setPolicySortKey(key);
    setPolicySortOrder('asc');
  };

  const loadDriveFiles = useCallback(async () => {
    if (!selectedDeal) {
      setDriveFiles([]);
      setDriveError(null);
      return;
    }

    setIsDriveLoading(true);
    try {
      const { files, folderId } = await fetchDealDriveFiles(selectedDeal.id);
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

  useEffect(() => {
    if (activeTab === 'files') {
      void loadDriveFiles();
      return;
    }

    setDriveFiles([]);
    setDriveError(null);
  }, [activeTab, loadDriveFiles]);

  const loadNotes = useCallback(
    async (filter: 'active' | 'archived') => {
      if (!selectedDeal) {
        setNotes([]);
        return;
      }
      setNotesLoading(true);
      setNotesError(null);
      try {
        const fetchedNotes = await fetchDealNotes(
          selectedDeal.id,
          filter === 'archived'
        );
        setNotes(fetchedNotes);
      } catch (err) {
        console.error('Ошибка загрузки заметок:', err);
        setNotesError(
          err instanceof Error ? err.message : 'Не удалось загрузить заметки'
        );
      } finally {
        setNotesLoading(false);
      }
    },
    [selectedDeal?.id]
  );

  useEffect(() => {
    if (activeTab !== 'notes') {
      return;
    }
    void loadNotes(notesFilter);
  }, [activeTab, loadNotes, notesFilter]);

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

  const renderTasksTab = () => {
    if (!selectedDeal) {
      return null;
    }

    if (!relatedTasks.length) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Задачи еще не созданы.</p>
          <button
            onClick={() => setIsCreatingTask(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
          >
            Создать задачу
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-slate-800">Задачи</h3>
          <button
            onClick={() => setIsCreatingTask(true)}
            className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
          >
            + Создать задачу
          </button>
        </div>
        <ul className="divide-y divide-slate-100">
          {displayedTasks.map((task) => (
            <li key={task.id} className="py-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p
                    className={`font-semibold text-sm ${
                      task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-900'
                    }`}
                  >
                    {task.title}
                  </p>
                  {task.description && (
                    <p
                      className={`text-sm mt-1 ${
                        task.status === 'done' ? 'text-slate-400 line-through' : 'text-slate-500'
                      }`}
                    >
                      {task.description}
                    </p>
                  )}
                  <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-4">
                    <span>Статус: {task.status}</span>
                    {task.dueAt && <span>Срок: {formatDate(task.dueAt)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {task.priority && (
                    <span className="text-xs font-semibold text-slate-500 uppercase bg-slate-100 rounded-full px-2 py-1 whitespace-nowrap">
                      {task.priority}
                    </span>
                  )}
                  {task.status !== 'done' && (
                    <button
                      onClick={() => handleMarkTaskDone(task.id)}
                      disabled={completingTaskIds.includes(task.id)}
                      className="text-xs text-emerald-600 hover:text-emerald-800 whitespace-nowrap"
                    >
                      {completingTaskIds.includes(task.id) ? 'Сохраняем...' : 'Сделано'}
                    </button>
                  )}
                  <button
                    onClick={() => setEditingTaskId(task.id)}
                    className="text-xs text-slate-400 hover:text-sky-600 whitespace-nowrap"
                  >
                    ✎ Редактировать
                  </button>
                  <button
                    onClick={() => onDeleteTask(task.id).catch(() => undefined)}
                    className="text-xs text-slate-400 hover:text-red-500 whitespace-nowrap"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );
  };

  const renderPolicyHeaderCell = (label: string, key: PolicySortKey) => (
    <th
      scope="col"
      className="px-4 py-3 cursor-pointer select-none text-left text-xs font-semibold uppercase tracking-wide text-slate-500 transition hover:text-slate-700"
      onClick={() => handlePolicySort(key)}
      aria-sort={
        policySortKey === key ? (policySortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
      }
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <span className="text-[0.55rem] text-slate-400">
          {policySortKey === key ? (policySortOrder === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </span>
    </th>
  );

  const renderPoliciesTab = () => {
    if (!selectedDeal) {
      return null;
    }

    if (!relatedPolicies.length) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Для сделки пока нет полисов.</p>
          <button
            onClick={() => onRequestAddPolicy(selectedDeal.id)}
            className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
          >
            Создать полис
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-slate-800">Полисы</h3>
          <button
            onClick={() => onRequestAddPolicy(selectedDeal.id)}
            className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
          >
            + Создать полис
          </button>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                {renderPolicyHeaderCell('Номер', 'number')}
                {renderPolicyHeaderCell('Компания', 'insuranceCompany')}
                {renderPolicyHeaderCell('Клиент', 'client')}
                {renderPolicyHeaderCell('Тип', 'insuranceType')}
                {renderPolicyHeaderCell('Начало', 'startDate')}
                {renderPolicyHeaderCell('Окончание', 'endDate')}
                {renderPolicyHeaderCell('Транспорт', 'transport')}
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Действие
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedPolicies.map((policy) => (
                <tr
                  key={policy.id}
                  className="transition hover:bg-slate-50 focus-within:bg-slate-50"
                >
                  <td className="px-4 py-3 font-semibold text-slate-900">{policy.number}</td>
                  <td className="px-4 py-3">{policy.insuranceCompany || '—'}</td>
                  <td className="px-4 py-3">{policy.clientName || '—'}</td>
                  <td className="px-4 py-3">{policy.insuranceType || '—'}</td>
                  <td className="px-4 py-3">{formatDate(policy.startDate)}</td>
                  <td className="px-4 py-3">{formatDate(policy.endDate)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {getPolicyTransportSummary(policy)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-xs font-semibold text-slate-400 transition hover:text-red-500"
                      onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderPaymentsByPoliciesTab = () => {
    if (!selectedDeal) {
      return null;
    }

    if (!relatedPolicies.length) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Для сделки пока нет полисов, добавьте их на вкладке «Полисы».
          </p>
          <button
            onClick={() => onRequestAddPolicy(selectedDeal.id)}
            className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
          >
            Создать полис
          </button>
        </div>
      );
    }

    const paymentsByPolicy = relatedPolicies.map((policy) => ({
      policy,
      payments: relatedPayments.filter((p) => p.policyId === policy.id),
    }));

    const renderRecordRows = (records: FinancialRecord[], recordType: 'income' | 'expense') => {
      if (!records.length) {
        return (
          <tr>
            <td colSpan={4} className="px-4 py-2 text-[11px] text-center text-slate-400">
              Записей нет
            </td>
          </tr>
        );
      }

      return records.map((record) => {
        const amountValue = Math.abs(Number(record.amount) || 0);
        const sign = recordType === 'income' ? '+' : '-';

        return (
          <tr key={record.id} className="border-t border-slate-100">
            <td className="px-4 py-2 text-xs text-slate-600">{record.description || 'Без описания'}</td>
            <td className="px-4 py-2 text-xs text-slate-600">{formatDate(record.date)}</td>
            <td className="px-4 py-2 text-right font-semibold text-sm text-slate-900">
              <span className={recordType === 'income' ? 'text-emerald-600' : 'text-red-600'}>
                {sign}
                {formatCurrency(amountValue.toString())}
              </span>
            </td>
            <td className="px-4 py-2 text-right text-xs text-slate-600 space-x-2">
              <button
                onClick={() => setEditingFinancialRecordId(record.id)}
                className="text-xs text-sky-600 hover:text-sky-800 font-semibold"
              >
                Редактировать
              </button>
              <button
                onClick={() => onDeleteFinancialRecord(record.id).catch(() => undefined)}
                className="text-xs text-red-500 hover:text-red-700 font-semibold"
              >
                Удалить
              </button>
            </td>
          </tr>
        );
      });
    };

    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-800">Платежи</h3>
          <p className="text-sm text-slate-500">
            Платежи полиса с доходами и расходами по каждому из них.
          </p>
        </div>

        <div className="space-y-5">
          {paymentsByPolicy.map(({ policy, payments }) => (
            <section
              key={policy.id}
              className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Полис №{policy.number || policy.id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {policy.insuranceType || '—'} · {policy.clientName || '—'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{policy.status || '—'}</span>
                  <button
                    onClick={() => {
                      setEditingPaymentId('new');
                      setCreatingPaymentPolicyId(policy.id);
                    }}
                    className="px-3 py-2 text-xs font-semibold text-sky-600 hover:text-sky-800"
                  >
                    + Создать платеж
                  </button>
                </div>
              </div>

              {payments.length === 0 ? (
                <p className="text-sm text-slate-500">Платежей по этому полису ещё нет.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50">
                  <table className="min-w-full text-sm text-left text-slate-600">
                    <thead className="bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.4em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-right">Сумма</th>
                        <th className="px-4 py-3">План</th>
                        <th className="px-4 py-3">Факт</th>
                        <th className="px-4 py-3 text-right">Действия</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white">
                      {payments.map((payment) => {
                        const incomes =
                          payment.financialRecords?.filter((record) => record.recordType === 'Доход') || [];
                        const expenses =
                          payment.financialRecords?.filter((record) => record.recordType === 'Расход') || [];

                        return (
                          <React.Fragment key={payment.id}>
                            <tr className="group hover:bg-slate-50">
                              <td className="px-4 py-4 text-right">
                                <p className="text-lg font-semibold text-slate-900">
                                  {formatCurrency(payment.amount)}
                                </p>
                                <p className="text-[11px] text-slate-500 mt-1">
                                  {payment.note || payment.description || 'Нет примечания'}
                                </p>
                              </td>
                              <td className="px-4 py-4 text-slate-600">
                                {formatDate(payment.scheduledDate)}
                              </td>
                              <td className="px-4 py-4 text-slate-600">
                                {formatDate(payment.actualDate)}
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => {
                                      setCreatingPaymentPolicyId(null);
                                      setEditingPaymentId(payment.id);
                                    }}
                                    className="text-xs text-sky-600 hover:text-sky-800 font-medium"
                                  >
                                    Редактировать
                                  </button>
                                </div>
                              </td>
                            </tr>
                            <tr className="bg-slate-50">
                              <td colSpan={6} className="px-4 py-4">
                                <div className="grid gap-5 md:grid-cols-2">
                                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                                      <span>Доходы</span>
                                      <button
                                        onClick={() =>
                                          setCreatingFinancialRecordContext({
                                            paymentId: payment.id,
                                            recordType: 'income',
                                          })
                                        }
                                        className="text-[10px] font-semibold text-sky-600 hover:text-sky-800"
                                      >
                                        Добавить
                                      </button>
                                    </div>
                                    <div className="mt-3 overflow-x-auto">
                                      <table className="min-w-full text-[11px] text-slate-600">
                                        <thead>
                                          <tr className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                                            <th className="px-3 py-2 text-left">Описание</th>
                                            <th className="px-3 py-2 text-left">Дата</th>
                                            <th className="px-3 py-2 text-right">Сумма</th>
                                            <th className="px-3 py-2 text-right">Действия</th>
                                          </tr>
                                        </thead>
                                        <tbody>{renderRecordRows(incomes, 'income')}</tbody>
                                      </table>
                                    </div>
                                  </div>
                                  <div className="rounded-xl border border-slate-200 bg-white p-3">
                                    <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                                      <span>Расходы</span>
                                      <button
                                        onClick={() =>
                                          setCreatingFinancialRecordContext({
                                            paymentId: payment.id,
                                            recordType: 'expense',
                                          })
                                        }
                                        className="text-[10px] font-semibold text-sky-600 hover:text-sky-800"
                                      >
                                        Добавить
                                      </button>
                                    </div>
                                    <div className="mt-3 overflow-x-auto">
                                      <table className="min-w-full text-[11px] text-slate-600">
                                        <thead>
                                          <tr className="text-[9px] uppercase tracking-[0.3em] text-slate-400">
                                            <th className="px-3 py-2 text-left">Описание</th>
                                            <th className="px-3 py-2 text-left">Дата</th>
                                            <th className="px-3 py-2 text-right">Сумма</th>
                                            <th className="px-3 py-2 text-right">Действия</th>
                                          </tr>
                                        </thead>
                                        <tbody>{renderRecordRows(expenses, 'expense')}</tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ))}
        </div>
      </div>
    );
  };
  const renderQuotesTab = () => {
    if (!selectedDeal) {
      return null;
    }

    const hasQuotes = quotes.length > 0;

    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-semibold text-slate-800">Предложенные продукты</h3>
          <button
            onClick={() => onRequestAddQuote(selectedDeal.id)}
            className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
          >
            + Добавить расчет
          </button>
        </div>
        {!hasQuotes ? (
          <p className="text-sm text-slate-500">Расчетов пока нет.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
            <table className="min-w-full text-sm text-left">
              <thead className="text-[10px] uppercase tracking-[0.2em] text-slate-500 bg-slate-50">
                <tr>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Компания</th>
                  <th className="px-4 py-3">Сумма</th>
                  <th className="px-4 py-3">Премия</th>
                  <th className="px-4 py-3">Франшиза</th>
                  <th className="px-4 py-3">Комментарии</th>
                  <th className="px-4 py-3">Добавлен</th>
                  <th className="px-4 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {quotes.map((quote) => (
                  <tr key={quote.id} className="odd:bg-white even:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-900">{quote.insuranceType}</td>
                    <td className="px-4 py-3 text-slate-600">{quote.insuranceCompany || '—'}</td>
                    <td className="px-4 py-3 text-slate-900">{formatCurrency(quote.sumInsured)}</td>
                    <td className="px-4 py-3 text-slate-900">{formatCurrency(quote.premium)}</td>
                    <td className="px-4 py-3 text-slate-900">{quote.deductible || '—'}</td>
                    <td className="px-4 py-3 text-slate-600">{quote.comments || '—'}</td>
                    <td className="px-4 py-3 text-slate-400">{formatDate(quote.createdAt)}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <button
                        className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                        onClick={() => onRequestEditQuote(quote)}
                        type="button"
                      >
                        Редактировать
                      </button>
                      <button
                        className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                        onClick={() => onDeleteQuote(selectedDeal.id, quote.id).catch(() => undefined)}
                        type="button"
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };
  const renderFilesTab = () => {
    if (!selectedDeal) {
      return null;
    }

    const disableUpload = !selectedDeal.driveFolderId;

    return (
      <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Файлы Google Drive</p>
            <p className="text-xs text-slate-500">
              Контент читается прямо из папки, привязанной к этой сделке.
            </p>
          </div>
          <button
            type="button"
            onClick={loadDriveFiles}
            disabled={!selectedDeal.driveFolderId || isDriveLoading}
            className="self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isDriveLoading ? 'Обновляю...' : 'Обновить'}
          </button>
        </div>

        <FileUploadManager
          onUpload={async (file) => {
            await uploadDealDriveFile(selectedDeal.id, file);
            await loadDriveFiles();
          }}
          disabled={disableUpload}
        />

        {driveError && (
          <p className="text-xs text-rose-500 bg-rose-50 p-3 rounded-lg">{driveError}</p>
        )}

        {!driveError && !selectedDeal.driveFolderId && (
          <p className="text-xs text-slate-500">
            Папка Google Drive ещё не создана. Сначала сохраните сделку, чтобы получить папку.
          </p>
        )}

        <div className="space-y-3 border-t border-slate-100 pt-4">
          {!driveError && selectedDeal.driveFolderId && isDriveLoading && (
            <p className="text-sm text-slate-500">Загружаю файлы...</p>
          )}

          {!driveError &&
            selectedDeal.driveFolderId &&
            !isDriveLoading &&
            sortedDriveFiles.length === 0 && (
              <p className="text-sm text-slate-500">Папка пуста.</p>
            )}

          {!driveError && sortedDriveFiles.length > 0 && (
            <div className="space-y-2">
              {sortedDriveFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xl">{getDriveItemIcon(file.isFolder)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 break-all">{file.name}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{formatDriveFileSize(file.size)}</span>
                        <span>{formatDriveDate(file.modifiedAt ?? file.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  {file.webViewLink ? (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800"
                    >
                      Открыть
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              ))}
            </div>
        )}
      </div>
    </section>
  );
};

  const renderNotesTab = () => {
    if (!selectedDeal) {
      return null;
    }

    const filterOptions: { value: 'active' | 'archived'; label: string }[] = [
      { value: 'active', label: 'Активные' },
      { value: 'archived', label: 'Архив' },
    ];

    return (
      <section className="space-y-6">
        <div className="space-y-3">
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
          {notesError && (
            <p className="text-xs text-rose-500">{notesError}</p>
          )}
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
                  {note.authorName || '—'}
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
                      {notesAction === note.id ? 'Архивируем...' : 'В архив'}
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
              : 'Архив пуст — вы ещё не отправляли заметки в архив.'}
          </div>
        )}
      </section>
    );
  };

  const renderChatTab = () => {
    if (!selectedDeal) {
      return null;
    }

    if (isChatLoading) {
      return <p className="text-sm text-slate-500">Загружаем сообщения...</p>;
    }

    return (
      <ChatBox
        messages={chatMessages}
        currentUser={currentUser}
        onSendMessage={async (body) => {
          await onSendChatMessage(selectedDeal.id, body);
          await loadChatMessages();
        }}
        onDeleteMessage={async (messageId) => {
          await onDeleteChatMessage(messageId);
          await loadChatMessages();
        }}
      />
    );
  };

  const renderActivityTab = () => {
    return <ActivityTimeline activities={activityLogs} isLoading={isActivityLoading} />;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': {
        const expectedCloseTone = getDeadlineTone(selectedDeal?.expectedClose);
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Клиент</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">
                  {selectedClient?.name || 'Не указан'}
                </p>
                {selectedClient?.phone && (
                  <p className="text-sm text-slate-500 mt-1">{selectedClient.phone}</p>
                )}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Следующий контакт</p>
                <div className="mt-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="date"
                      value={selectedDeal?.nextContactDate ?? ''}
                      onChange={(event) =>
                        handleInlineDateChange('nextContactDate', event.target.value)
                      }
                      disabled={savingDateField === 'nextContactDate'}
                      className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:ring focus:ring-sky-100"
                    />
                    {savingDateField === 'nextContactDate' && (
                      <span className="text-xs text-slate-500">Сохраняем...</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    {QUICK_NEXT_CONTACT_OPTIONS.map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => handleQuickNextContact(option.days)}
                        disabled={savingDateField === 'nextContactDate'}
                        className="rounded-full border border-slate-300 px-3 py-1 transition hover:border-sky-400 hover:text-sky-600 disabled:opacity-50"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <p className={`text-xs uppercase tracking-wide ${expectedCloseTone}`}>
                  Застраховать не позднее чем
                </p>
                <div className="mt-1 flex items-center gap-3">
                  <input
                    type="date"
                    value={selectedDeal?.expectedClose ?? ''}
                    onChange={(event) =>
                      handleInlineDateChange('expectedClose', event.target.value)
                    }
                    disabled={savingDateField === 'expectedClose'}
                    className="max-w-[220px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 focus:border-sky-500 focus:ring focus:ring-sky-100"
                  />
                  {savingDateField === 'expectedClose' && (
                    <span className="text-xs text-slate-500">Сохраняем...</span>
                  )}
                </div>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
              {selectedDeal?.description ? (
                <p>{selectedDeal.description}</p>
              ) : (
                <p>Описание сделки не заполнено.</p>
              )}
            </div>
          </div>
        );
      }
      case 'tasks':
        return renderTasksTab();
      case 'policies':
        return renderPoliciesTab();
      case 'payments':
        return renderPaymentsByPoliciesTab();
      case 'quotes':
        return renderQuotesTab();
      case 'files':
        return renderFilesTab();
      case 'chat':
        return renderChatTab();
      case 'notes':
        return renderNotesTab();
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
        <div className="px-5 py-3 border-b border-slate-100">
          <label htmlFor="dealSearch" className="sr-only">
            Поиск по сделкам
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
        <div className="flex-1 overflow-y-auto">
{sortedDeals.map((deal) => {
            const isOverdue = deal.nextContactDate
              ? new Date(deal.nextContactDate) < new Date()
              : false;
            const deadlineTone = getDeadlineTone(deal.expectedClose);
            return (
              <button
                key={deal.id}
                onClick={() => onSelectDeal(deal.id)}
                className={`w-full text-left px-5 py-4 border-b border-slate-100 transition ${
                  selectedDeal?.id === deal.id ? 'bg-sky-50' : 'hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
                <p className="text-xs text-slate-500 mt-1">{statusLabels[deal.status]}</p>
                <p className="text-xs text-slate-400 mt-1">Клиент: {deal.clientName || '-'}</p>
                <p className={`text-xs mt-1 ${deadlineTone}`}>
                  Застраховать не позднее чем: {formatDate(deal.expectedClose)}
                </p>
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
          {!sortedDeals.length && <p className="p-6 text-sm text-slate-500">Сделок пока нет</p>}
        </div>
      </section>

      <section className="xl:col-span-3 space-y-6">
        {selectedDeal ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Сделка</p>
                <h2 className="text-2xl font-semibold text-slate-900">{selectedDeal.title}</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedClient?.name || 'Клиент не выбран'}
                </p>
                <p className="text-sm text-slate-500 mt-1">
                  Продавец: {selectedDeal.sellerName || '—'} · Исполнитель: {selectedDeal.executorName || '—'}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="text-sm text-slate-600">Статус</label>
                <select
                  value={selectedDeal.status}
                  onChange={(event) =>
                    onUpdateStatus(selectedDeal.id, event.target.value as DealStatus)
                  }
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setIsEditingDeal(true)}
                  className="px-3 py-2 text-sm font-medium text-sky-600 hover:bg-sky-50 rounded-lg border border-sky-200"
                >
                  ✎ Редактировать
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Вероятность</p>
                <p className="text-lg font-semibold">{selectedDeal.probability}%</p>
              </div>
              <div>
                <p className="text-slate-500">Источник</p>
                <p className="text-lg font-semibold">{selectedDeal.source || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Канал</p>
                <p className="text-lg font-semibold">{selectedDeal.channel || '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Создана</p>
                <p className="text-lg font-semibold">{formatDate(selectedDeal.createdAt)}</p>
              </div>
            </div>

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

      {/* Edit Deal Modal */}
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

      {/* Create Task Modal */}
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

      {/* Edit Task Modal */}
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

      {/* Create/Edit Payment Modal */}
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

      {/* Create/Edit Financial Record Modal */}
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
    </div>
  );
};
