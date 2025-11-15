import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityLog,
  Client,
  Deal,
  DealStatus,
  FinancialRecord,
  Payment,
  Policy,
  Task,
  User,
  ChatMessage,
} from '../../types';
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
  { id: 'finance', label: 'Финансы' },
  { id: 'notes', label: 'Заметки' },
  { id: 'history', label: 'История' },
] as const;

type DealTabId = (typeof DEAL_TABS)[number]['id'];

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

interface DealsViewProps {
  deals: Deal[];
  clients: Client[];
  policies: Policy[];
  payments: Payment[];
  financialRecords: FinancialRecord[];
  tasks: Task[];
  users: User[];
  selectedDealId: string | null;
  onSelectDeal: (dealId: string) => void;
  onUpdateStatus: (dealId: string, status: DealStatus) => Promise<void>;
  onUpdateDeal: (dealId: string, data: EditDealFormValues) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
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
  onUploadDocument: (dealId: string, file: File) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onFetchChatMessages: (dealId: string) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, authorName: string, body: string) => Promise<void>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchActivityLogs: (dealId: string) => Promise<ActivityLog[]>;
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
  onRequestAddPolicy,
  onDeleteQuote,
  onDeletePolicy,
  onAddPayment,
  onUpdatePayment,
  onAddFinancialRecord,
  onUpdateFinancialRecord,
  onUploadDocument,
  onDeleteDocument,
  onFetchChatMessages,
  onSendChatMessage,
  onDeleteChatMessage,
  onFetchActivityLogs,
  onCreateTask,
  onUpdateTask,
  onDeleteTask,
  dealSearch,
  onDealSearchChange,
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
  const [creatingFinancialRecordForPaymentId, setCreatingFinancialRecordForPaymentId] = useState<
    string | null
  >(null);
  const [savingDateField, setSavingDateField] = useState<
    'nextContactDate' | 'expectedClose' | null
  >(null);

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
      const logs = await onFetchActivityLogs(selectedDeal.id);
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

  const relatedPolicies = useMemo(
    () => (selectedDeal ? policies.filter((p) => p.dealId === selectedDeal.id) : []),
    [policies, selectedDeal]
  );
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
        <div className="space-y-3">
          {relatedPolicies.map((policy) => (
            <div key={policy.id} className="border border-slate-200 rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{policy.number}</p>
                  <p className="text-xs text-slate-500 mt-1">{policy.insuranceCompany}</p>
                  <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-4">
                    <span>Тип: {policy.insuranceType}</span>
                    <span>
                      Период: {formatDate(policy.startDate)} — {formatDate(policy.endDate)}
                    </span>
                    <span>Сумма: {formatCurrency(policy.amount)}</span>
                  </div>
                </div>
                <button
                  className="text-xs text-slate-400 hover:text-red-500"
                  onClick={() => onDeletePolicy(policy.id).catch(() => undefined)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPaymentsByPoliciesTab = () => {
    if (!selectedDeal) {
      return null;
    }

    // Группируем платежи по полисам
    const paymentsByPolicy = relatedPolicies.map((policy) => ({
      policy,
      payments: relatedPayments.filter((p) => p.policyId === policy.id),
    }));

    if (!paymentsByPolicy.some((g) => g.payments.length > 0)) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Платежей пока нет.</p>
          <button
            onClick={() => setEditingPaymentId('new')}
            className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
          >
            Создать платеж
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <div className="flex justify-end">
          <button
            onClick={() => setEditingPaymentId('new')}
            className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
          >
            + Создать платеж
          </button>
        </div>

        {paymentsByPolicy.map(({ policy, payments }) => (
          <div key={policy.id} className="border border-slate-200 rounded-xl p-4">
            <h4 className="font-semibold text-slate-900 mb-4">Полис: {policy.number}</h4>
            {payments.length === 0 ? (
              <p className="text-sm text-slate-500">Платежей по этому полису нет</p>
            ) : (
              <div className="space-y-3">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="border border-slate-100 rounded-lg p-4 bg-slate-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <p className="font-semibold text-slate-900">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-sm text-slate-600 mt-1">
                          {payment.description || 'Нет описания'}
                        </p>
                        <div className="text-xs text-slate-500 mt-2 flex flex-wrap gap-4">
                          <span>Запланировано: {formatDate(payment.scheduledDate)}</span>
                          <span>Факт: {formatDate(payment.actualDate)}</span>
                          <span>Статус: {payment.status}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setEditingPaymentId(payment.id)}
                          className="text-xs text-sky-600 hover:text-sky-800 font-medium"
                        >
                          Редактировать
                        </button>
                        <button
                          onClick={() => setCreatingFinancialRecordForPaymentId(payment.id)}
                          className="text-xs text-emerald-600 hover:text-emerald-800 font-medium"
                        >
                          + Запись
                        </button>
                      </div>
                    </div>

                    {/* Финансовые записи платежа */}
                    {payment.financialRecords && payment.financialRecords.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-xs font-semibold text-slate-600 mb-3">
                          Финансовые записи:
                        </p>
                        <div className="space-y-2">
                          {payment.financialRecords.map((record) => (
                            <div
                              key={record.id}
                              className="flex items-center justify-between text-xs bg-white p-2 rounded border border-slate-100"
                            >
                              <div>
                                <span
                                  className={`font-semibold ${parseFloat(record.amount) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}
                                >
                                  {parseFloat(record.amount) >= 0 ? '+' : '-'}
                                  {Math.abs(parseFloat(record.amount)).toLocaleString('ru-RU', {
                                    style: 'currency',
                                    currency: 'RUB',
                                  })}
                                </span>
                                <span className="text-slate-500 ml-2">
                                  {record.description || '—'}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setEditingFinancialRecordId(record.id)}
                                  className="text-blue-600 hover:text-blue-800"
                                >
                                  ✎
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderFinanceTab = () => {
    if (!relatedPayments.length) {
      return <p className="text-sm text-slate-500">Платежей пока нет.</p>;
    }
    return (
      <div className="space-y-3">
        {relatedPayments.map((payment) => (
          <div key={payment.id} className="border border-slate-100 rounded-xl p-3 text-sm">
            <p className="font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
            <p className="text-slate-500">{payment.description || 'Без описания'}</p>
            <p className="text-xs text-slate-400 mt-1">
              Запланировано: {formatDate(payment.scheduledDate)}
            </p>
            <p className="text-xs text-slate-400">Факт: {formatDate(payment.actualDate)}</p>
            <p className="text-xs text-slate-500 mt-1">Статус: {payment.status}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderQuotesTab = () => {
    if (!selectedDeal) {
      return null;
    }

    if (!quotes.length) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Расчетов пока нет.</p>
          <button
            onClick={() => onRequestAddQuote(selectedDeal.id)}
            className="px-4 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700"
          >
            Добавить расчет
          </button>
        </div>
      );
    }

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
        <div className="space-y-3">
          {quotes.map((quote) => (
            <div key={quote.id} className="border border-slate-200 rounded-xl p-4">
              <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_auto]">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{quote.insuranceType}</p>
                  <p className="text-xs text-slate-500">{quote.insuranceCompany || '—'}</p>
                  <p className="text-xs text-slate-400">
                    Добавлен {formatDate(quote.createdAt)}
                  </p>
                </div>
                <div className="flex items-start justify-end">
                  <button
                    className="text-xs text-slate-400 hover:text-red-500"
                    onClick={() => onDeleteQuote(selectedDeal.id, quote.id).catch(() => undefined)}
                  >
                    Удалить
                  </button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-slate-600">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    Страховая сумма
                  </p>
                  <p className="font-semibold">{formatCurrency(quote.sumInsured)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Премия</p>
                  <p className="font-semibold">{formatCurrency(quote.premium)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Франшиза</p>
                  <p className="font-semibold">{quote.deductible || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Комментарии</p>
                  <p className="font-semibold">{quote.comments || '—'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFilesTab = () => {
    if (!selectedDeal) {
      return null;
    }

    return (
      <FileUploadManager
        dealId={selectedDeal.id}
        documents={selectedDeal.documents || []}
        onUpload={(file) => onUploadDocument(selectedDeal.id, file)}
        onDelete={onDeleteDocument}
      />
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
        onSendMessage={async (authorName, body) => {
          await onSendChatMessage(selectedDeal.id, authorName, body);
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

  const renderPlaceholder = (label: string) => (
    <div className="text-sm text-slate-500">
      {label} появится после имплементации соответствующей фичи.
    </div>
  );

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
      case 'finance':
        return renderFinanceTab();
      case 'quotes':
        return renderQuotesTab();
      case 'files':
        return renderFilesTab();
      case 'chat':
        return renderChatTab();
      case 'notes':
        return renderPlaceholder('Заметки');
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
                onSubmit={async (data) => {
                  if (editingPaymentId === 'new') {
                    await onAddPayment(data);
                  } else {
                    await onUpdatePayment(editingPaymentId, data);
                  }
                  setEditingPaymentId(null);
                }}
                onCancel={() => setEditingPaymentId(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Financial Record Modal */}
      {(editingFinancialRecordId || creatingFinancialRecordForPaymentId) && selectedDeal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-screen overflow-y-auto">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">
                {editingFinancialRecordId ? 'Редактировать запись' : 'Новая финансовая запись'}
              </h3>
              <button
                onClick={() => {
                  setEditingFinancialRecordId(null);
                  setCreatingFinancialRecordForPaymentId(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <AddFinancialRecordForm
                paymentId={creatingFinancialRecordForPaymentId || ''}
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
                  setCreatingFinancialRecordForPaymentId(null);
                }}
                onCancel={() => {
                  setEditingFinancialRecordId(null);
                  setCreatingFinancialRecordForPaymentId(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
