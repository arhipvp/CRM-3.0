// Fix: Implemented the ClientDetails component to display deal information.
// Although named ClientDetails, it functions as DealDetails to fit the application's context.
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Client, Deal, DealStatus, Task, Quote, Policy, Payment, FinancialTransaction } from '../types';
import { AddQuoteForm } from './AddQuoteForm';
import { AddPolicyForm } from './AddPolicyForm';
import { AddPaymentForm } from './AddPaymentForm';
import { AddFinancialTransactionForm } from './AddFinancialTransactionForm';


interface ClientDetailsProps {
  deal: Deal | null;
  client: Client | null;
  policies: Policy[];
  payments: Payment[];
  financialTransactions: FinancialTransaction[];
  allUsers: string[];
  allClients: Client[];
  onUpdateDealStatus: (dealId: string, newStatus: DealStatus, reason?: string) => void;
  onUpdateDealTitle: (dealId: string, newTitle: string) => void;
  onUpdateDealClient: (dealId: string, newClientId: string) => void;
  onAddNote: (dealId: string, content: string) => void;
  onUpdateNoteStatus: (dealId: string, noteId: string, status: 'active' | 'archived') => void;
  onAddQuote: (dealId: string, quoteData: Omit<Quote, 'id'>) => void;
  onDeleteQuote: (dealId: string, quoteId: string) => void;
  onAddFile: (dealId: string, file: File) => void;
  onDeleteFile: (dealId: string, fileId: string) => void;
  onAddPolicy: (dealId: string, policyData: Omit<Policy, 'id' | 'clientId' | 'dealId'>, installments: Array<Omit<Payment, 'id' | 'clientId' | 'policyId' | 'status'>>, policyClientId: string) => void;
  onAddPayment: (policyId: string, paymentData: Omit<Payment, 'id' | 'policyId' | 'clientId'>) => void;
  onAddTask: (dealId: string, taskData: Omit<Task, 'id' | 'completed'>) => void;
  onToggleTask: (dealId: string, taskId: string) => void;
  onAddFinancialTransaction: (transactionData: Omit<FinancialTransaction, 'id'>) => void;
  onAddChatMessage: (dealId: string, text: string) => void;
}

const DEAL_STATUSES: DealStatus[] = [
  'Новая',
  'Расчет',
  'Переговоры',
  'Оформление',
  'Ожидает продления',
  'Закрыта',
];

const getDaysNoun = (days: number): string => {
    const cases = [2, 0, 1, 1, 1, 2];
    const titles = ['день', 'дня', 'дней'];
    const number = Math.abs(days);
    return titles[(number % 100 > 4 && number % 100 < 20) ? 2 : cases[(number % 10 < 5) ? number % 10 : 5]];
};

const TaskDueDateNotifier: React.FC<{ task: Task }> = ({ task }) => {
    if (task.completed) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const timeDiff = dueDate.getTime() - today.getTime();
    const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));

    // Fix: Changed JSX.Element to React.ReactElement to resolve "Cannot find namespace 'JSX'" error.
    let notification: { icon: React.ReactElement; message: string; colorClass: string } | null = null;

    if (daysRemaining < 0) {
        notification = {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
            message: `Просрочено на ${Math.abs(daysRemaining)} ${getDaysNoun(Math.abs(daysRemaining))}`,
            colorClass: 'text-red-500',
        };
    } else if (daysRemaining === 0) {
        notification = {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>,
            message: 'Срок истекает сегодня',
            colorClass: 'text-red-500',
        };
    } else if (daysRemaining <= 3) {
        notification = {
            icon: <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" /></svg>,
            message: `Срок истекает через ${daysRemaining} ${getDaysNoun(daysRemaining)}`,
            colorClass: 'text-orange-500',
        };
    }

    if (!notification) return null;

    return (
        <div className={`relative flex items-center ml-2 group ${notification.colorClass}`} title={notification.message}>
            {notification.icon}
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-2 py-1 text-xs text-white bg-slate-700 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {notification.message}
            </span>
        </div>
    );
};

const CloseDealModal: React.FC<{
  onClose: () => void;
  onSubmit: (reason: string) => void;
}> = ({ onClose, onSubmit }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      onSubmit(reason);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">Укажите причину закрытия</h2>
           <button type="button" onClick={onClose} className="p-1 rounded-full text-slate-400 hover:bg-slate-100">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <p className="text-sm text-slate-600">Эта информация будет добавлена в заметки и историю сделки.</p>
        <div>
          <label htmlFor="close_reason" className="sr-only">Причина закрытия</label>
          <textarea
            id="close_reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-sky-500 focus:ring-sky-500"
            rows={4}
            placeholder="Например: клиент выбрал конкурента из-за цены, проект отложен на неопределенный срок и т.д."
            required
          />
        </div>
        <div className="flex justify-end pt-4 space-x-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200">Отмена</button>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700">Закрыть сделку</button>
        </div>
      </form>
    </div>
  );
};

const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount);
};

const formatBytes = (bytes: number, decimals = 2): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

const getPaymentStatusInfo = (policyId: string, payments: Payment[]): { text: 'Просрочен' | 'Ожидает оплаты' | 'Все оплачены' | 'Нет платежей'; className: string } => {
    const policyPayments = payments.filter(p => p.policyId === policyId);

    if (policyPayments.length === 0) {
        return { text: 'Нет платежей', className: 'bg-slate-100 text-slate-600' };
    }
    if (policyPayments.some(p => p.status === 'Просрочен')) {
        return { text: 'Просрочен', className: 'bg-red-100 text-red-800' };
    }
    if (policyPayments.some(p => p.status === 'Ожидает')) {
        return { text: 'Ожидает оплаты', className: 'bg-yellow-100 text-yellow-800' };
    }
    return { text: 'Все оплачены', className: 'bg-green-100 text-green-800' };
};

const PaymentStatusBadge: React.FC<{ statusInfo: { text: string; className: string } }> = ({ statusInfo }) => (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.className}`}>{statusInfo.text}</span>
);

const SortIcon: React.FC<{ direction?: 'ascending' | 'descending' }> = ({ direction }) => {
    if (!direction) {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block ml-1 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" /></svg>;
    }
    if (direction === 'ascending') {
        return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block ml-1 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>;
    }
    return <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 inline-block ml-1 text-sky-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>;
};

export const ClientDetails: React.FC<ClientDetailsProps> = ({
  deal,
  client,
  policies,
  payments,
  financialTransactions,
  allUsers,
  allClients,
  onUpdateDealStatus,
  onUpdateDealTitle,
  onUpdateDealClient,
  onAddNote,
  onUpdateNoteStatus,
  onAddQuote,
  onDeleteQuote,
  onAddFile,
  onDeleteFile,
  onAddPolicy,
  onAddPayment,
  onAddTask,
  onToggleTask,
  onAddFinancialTransaction,
  onAddChatMessage,
}) => {
  const [activeTab, setActiveTab] = useState('Обзор');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitleValue, setEditingTitleValue] = useState(deal?.title || '');
  const [showAddQuote, setShowAddQuote] = useState(false);
  const [showAddPolicy, setShowAddPolicy] = useState(false);
  const [quoteForPolicy, setQuoteForPolicy] = useState<Quote | undefined>(undefined);
  const [policyForPayment, setPolicyForPayment] = useState<Policy | null>(null);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddFinancial, setShowAddFinancial] = useState(false);
  const [isCloseReasonModalOpen, setCloseReasonModalOpen] = useState(false);
  const [pendingStatusChange, setPendingStatusChange] = useState<{ dealId: string; newStatus: DealStatus } | null>(null);
  const [isClientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const clientSelectorRef = useRef<HTMLDivElement>(null);
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const [noteContent, setNoteContent] = useState('');
  
  const [taskDescription, setTaskDescription] = useState('');
  const [taskAssignee, setTaskAssignee] = useState<string>('');
  const [taskDueDate, setTaskDueDate] = useState('');

  const [chatMessage, setChatMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [policySortConfig, setPolicySortConfig] = useState<{ key: string; direction: 'ascending' | 'descending' } | null>({ key: 'endDate', direction: 'ascending' });

  const sortedDealPolicies = useMemo(() => {
    const enriched = policies.map(policy => {
        const policyPayments = payments.filter(p => p.policyId === policy.id);
        const policyPremium = policyPayments.reduce((sum, p) => sum + p.amount, 0);
        const statusInfo = getPaymentStatusInfo(policy.id, payments);
        return { ...policy, policyPremium, statusInfo };
    });

    if (policySortConfig !== null) {
        enriched.sort((a, b) => {
            const aValue = a[policySortConfig.key as keyof typeof a];
            const bValue = b[policySortConfig.key as keyof typeof b];

            let comparison = 0;
            if (policySortConfig.key === 'policyPremium') {
                comparison = a.policyPremium - b.policyPremium;
            } else if (policySortConfig.key === 'startDate' || policySortConfig.key === 'endDate') {
                comparison = new Date(aValue as string).getTime() - new Date(bValue as string).getTime();
            } else if (policySortConfig.key === 'status') {
                 comparison = a.statusInfo.text.localeCompare(b.statusInfo.text);
            } else {
                comparison = String(aValue).localeCompare(String(bValue));
            }
            
            return policySortConfig.direction === 'ascending' ? comparison : -comparison;
        });
    }
    
    return enriched;
  }, [policies, payments, policySortConfig]);
  
  useEffect(() => {
    if (deal) {
      setTaskAssignee(deal.owner);
      setEditingTitleValue(deal.title);
      setIsEditingTitle(false);
      // Сбрасываем раскрытые задачи при смене сделки
      setExpandedTasks(new Set());
    }
  }, [deal]);

  useEffect(() => {
    if (activeTab === 'Чат') {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [deal?.chat, activeTab]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (clientSelectorRef.current && !clientSelectorRef.current.contains(event.target as Node)) {
        setClientSelectorOpen(false);
        setClientSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  if (!deal || !client) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-slate-900">Нет выбранной сделки</h3>
          <p className="mt-1 text-sm text-slate-500">Выберите сделку из списка слева, чтобы увидеть детали.</p>
        </div>
      </div>
    );
  }
  
  const dealFinancials = financialTransactions.filter(t => t.dealId === deal.id);
  
  const handleTitleSave = () => {
    if (editingTitleValue.trim() && editingTitleValue.trim() !== deal.title) {
        onUpdateDealTitle(deal.id, editingTitleValue.trim());
    }
    setIsEditingTitle(false);
  };
  
  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
        handleTitleSave();
    } else if (e.key === 'Escape') {
        setEditingTitleValue(deal.title);
        setIsEditingTitle(false);
    }
  };

  const handleClientSelect = (newClientId: string) => {
    if (newClientId !== deal.clientId) {
        onUpdateDealClient(deal.id, newClientId);
    }
    setClientSelectorOpen(false);
    setClientSearchQuery('');
  };

  const filteredClients = allClients.filter(c =>
    c.name.toLowerCase().includes(clientSearchQuery.toLowerCase())
  );

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (noteContent.trim()) {
      onAddNote(deal.id, noteContent);
      setNoteContent('');
    }
  };

  const handleTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (taskDescription.trim() && taskDueDate) {
      onAddTask(deal.id, { description: taskDescription, assignee: taskAssignee, dueDate: taskDueDate });
      setTaskDescription('');
      setTaskDueDate('');
      setTaskAssignee(deal.owner); // Reset assignee to default after submit
    }
  };

  const handleChatSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (chatMessage.trim()) {
      onAddChatMessage(deal.id, chatMessage);
      setChatMessage('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onAddFile(deal.id, e.target.files[0]);
    }
  };
  
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as DealStatus;
    if (newStatus === 'Закрыта') {
      setPendingStatusChange({ dealId: deal.id, newStatus });
      setCloseReasonModalOpen(true);
    } else {
      onUpdateDealStatus(deal.id, newStatus);
    }
  };

  const handleCloseDealSubmit = (reason: string) => {
    if (pendingStatusChange) {
      onUpdateDealStatus(pendingStatusChange.dealId, pendingStatusChange.newStatus, reason);
    }
    setCloseReasonModalOpen(false);
    setPendingStatusChange(null);
  };
  
  const requestPolicySort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (policySortConfig && policySortConfig.key === key && policySortConfig.direction === 'ascending') {
        direction = 'descending';
    }
    setPolicySortConfig({ key, direction });
  };

  const getPolicySortDirection = (key: string) => {
      if (!policySortConfig || policySortConfig.key !== key) return undefined;
      return policySortConfig.direction;
  };

  const toggleTaskExpansion = (taskId: string) => {
    setExpandedTasks(prev => {
        const newSet = new Set(prev);
        if (newSet.has(taskId)) {
            newSet.delete(taskId);
        } else {
            newSet.add(taskId);
        }
        return newSet;
    });
  };

  const TABS = ['Обзор', 'Задачи', 'Расчеты', 'Чат', 'Файлы', 'Полисы', 'Финансы', 'Заметки', 'История'];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Обзор':
        return <p className="text-slate-600 whitespace-pre-wrap">{deal.summary}</p>;
      
      case 'Задачи':
        return (
          <div>
            <form onSubmit={handleTaskSubmit} className="mb-6 p-4 bg-slate-50 rounded-lg space-y-3">
              <h3 className="font-semibold text-slate-800">Новая задача</h3>
              <textarea
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                placeholder="Описание задачи..."
                className="w-full border-slate-300 rounded-md"
                rows={2}
              />
              <div className="flex items-center gap-4">
                <select value={taskAssignee} onChange={e => setTaskAssignee(e.target.value)} className="border-slate-300 rounded-md text-sm">
                  {allUsers.map(user => <option key={user} value={user}>{user}</option>)}
                </select>
                <input type="date" value={taskDueDate} onChange={e => setTaskDueDate(e.target.value)} className="border-slate-300 rounded-md text-sm" />
                <button type="submit" className="px-4 py-2 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700 ml-auto">Добавить</button>
              </div>
            </form>
            <ul className="space-y-3">
              {deal.tasks.map(task => {
                  const isExpanded = expandedTasks.has(task.id);
                  const hasDetails = (task.subtasks && task.subtasks.length > 0) || (task.attachments && task.attachments.length > 0);

                  return (
                    <li key={task.id} className="bg-white border border-slate-200 rounded-md transition-shadow hover:shadow-sm">
                      <div 
                          className={`flex items-center p-3 ${hasDetails ? 'cursor-pointer' : ''}`}
                          onClick={hasDetails ? () => toggleTaskExpansion(task.id) : undefined}
                      >
                        <input 
                            type="checkbox" 
                            checked={task.completed} 
                            onChange={(e) => {
                                e.stopPropagation();
                                onToggleTask(deal.id, task.id);
                            }} 
                            onClick={(e) => e.stopPropagation()}
                            className="h-5 w-5 rounded border-gray-300 text-sky-600 focus:ring-sky-500 flex-shrink-0" 
                        />
                        <div className="ml-3 flex-1 min-w-0">
                          <p className={`${task.completed ? 'line-through text-slate-500' : 'text-slate-800'}`}>{task.description}</p>
                          <div className="flex items-center">
                              <p className="text-xs text-slate-500">{task.assignee}, до {task.dueDate}</p>
                              <TaskDueDateNotifier task={task} />
                          </div>
                        </div>
                        {hasDetails && (
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                className={`h-5 w-5 text-slate-400 transition-transform flex-shrink-0 ml-2 ${isExpanded ? 'rotate-180' : ''}`} 
                                viewBox="0 0 20 20" 
                                fill="currentColor">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        )}
                      </div>
                      {isExpanded && hasDetails && (
                          <div className="pl-12 pr-4 pb-3 border-t border-slate-100 pt-3">
                              {task.subtasks && task.subtasks.length > 0 && (
                                  <div className="mb-3">
                                      <h4 className="text-xs font-semibold text-slate-600 mb-2">Подзадачи:</h4>
                                      <ul className="space-y-1.5">
                                          {task.subtasks.map(subtask => (
                                              <li key={subtask.id} className="flex items-center text-sm">
                                                  <input type="checkbox" readOnly checked={subtask.completed} className="h-4 w-4 rounded border-gray-300 text-sky-600 focus:ring-0 cursor-default" />
                                                  <span className={`ml-2 ${subtask.completed ? 'line-through text-slate-400' : 'text-slate-700'}`}>{subtask.description}</span>
                                              </li>
                                          ))}
                                      </ul>
                                  </div>
                              )}
                              {task.attachments && task.attachments.length > 0 && (
                                  <div>
                                       <h4 className="text-xs font-semibold text-slate-600 mb-2">Прикрепленные файлы:</h4>
                                       <ul className="space-y-1">
                                          {task.attachments.map(file => (
                                              <li key={file.id}>
                                                  <a href="#" onClick={e => e.preventDefault()} className="flex items-center text-sm text-sky-700 hover:underline group">
                                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5 text-slate-400 group-hover:text-sky-600" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a3 3 0 10-6 0v4a1 1 0 102 0V7a1 1 0 112 0v4a3 3 0 11-6 0V7a5 5 0 0110 0v4a5 5 0 01-10 0V7z" clipRule="evenodd" />
                                                      </svg>
                                                      <span>{file.name} <span className="text-slate-400">({formatBytes(file.size)})</span></span>
                                                  </a>
                                              </li>
                                          ))}
                                       </ul>
                                  </div>
                              )}
                          </div>
                      )}
                    </li>
                  );
                })}
            </ul>
          </div>
        );

      case 'Расчеты':
        return (
          <div>
            <button onClick={() => setShowAddQuote(true)} className="mb-4 px-4 py-2 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700">Добавить расчет</button>
            <div className="space-y-4">
              {deal.quotes.map(quote => (
                <div key={quote.id} className="p-4 border border-slate-200 rounded-lg">
                   <div className="flex justify-between items-start">
                      <div>
                         <h4 className="font-bold text-lg text-slate-800">{quote.insurer}</h4>
                         <p className="text-sm text-slate-500">{quote.insuranceType || 'Общее'}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => { setQuoteForPolicy(quote); setShowAddPolicy(true); }} className="p-2 text-xs bg-green-100 text-green-800 rounded hover:bg-green-200" title="Создать полис">Полис</button>
                        <button onClick={() => onDeleteQuote(deal.id, quote.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-100 rounded-full" title="Удалить"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                      </div>
                   </div>
                   <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div><span className="text-slate-500 block">Премия</span><span className="font-semibold text-slate-800">{formatCurrency(quote.premium)}</span></div>
                      <div><span className="text-slate-500 block">Сумма</span><span className="font-semibold text-slate-800">{formatCurrency(quote.sumInsured)}</span></div>
                      <div><span className="text-slate-500 block">Франшиза</span><span className="font-semibold text-slate-800">{quote.deductible || '-'}</span></div>
                   </div>
                   {quote.comments && <p className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-md">{quote.comments}</p>}
                </div>
              ))}
            </div>
          </div>
        );
        
      case 'Чат': {
        const currentUser = 'Пользователь'; // Hardcoded for example purposes
        return (
          <>
            <div className="space-y-4 pb-24">
              {deal.chat.map(msg => (
                <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === currentUser ? 'justify-end' : 'justify-start'}`}>
                  {msg.sender !== currentUser && <span className="flex-shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full bg-slate-200 text-sm font-bold text-slate-600" title={msg.sender}>{msg.sender.charAt(0)}</span>}
                  <div className={`max-w-md lg:max-w-lg p-3 rounded-lg ${msg.sender === currentUser ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-800'}`}>
                    <p className="text-sm font-semibold mb-1">{msg.sender}</p>
                    <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                    <p className={`text-xs mt-1 ${msg.sender === currentUser ? 'text-sky-100' : 'text-slate-400'} text-right`}>{new Date(msg.timestamp).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-4 border-t border-slate-200 bg-slate-50/80 backdrop-blur-sm">
              <form onSubmit={handleChatSubmit} className="flex items-center space-x-2">
                <textarea
                  value={chatMessage}
                  onChange={e => setChatMessage(e.target.value)}
                  onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleChatSubmit(e);
                      }
                  }}
                  placeholder="Напишите сообщение..."
                  className="w-full border-slate-300 rounded-md text-sm shadow-sm focus:ring-sky-500 focus:border-sky-500"
                  rows={1}
                />
                <button type="submit" className="px-3 py-2 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700 flex-shrink-0" title="Отправить">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
              </form>
            </div>
          </>
        );
      }

      case 'Файлы':
        return (
          <div>
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="mb-4 px-4 py-2 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700">Загрузить файл</button>
            <ul className="space-y-2">
              {deal.files.map(file => (
                <li key={file.id} className="flex items-center p-2 border border-slate-200 rounded-md">
                   <span className="flex-1 truncate">{file.name}</span>
                   <span className="text-sm text-slate-500 mr-4">{formatBytes(file.size)}</span>
                   <button onClick={() => onDeleteFile(deal.id, file.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-full" title="Удалить"><svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                </li>
              ))}
            </ul>
          </div>
        );
      
      case 'Полисы':
        const headers: { label: string, key: string }[] = [
            { label: 'Полис', key: 'policyNumber' },
            { label: 'Контрагент', key: 'counterparty' },
            { label: 'Дата начала', key: 'startDate' },
            { label: 'Дата окончания', key: 'endDate' },
            { label: 'Премия', key: 'policyPremium' },
            { label: 'Платежи', key: 'payments' },
            { label: 'Статус', key: 'status' },
        ];
        return (
            <div className="space-y-4">
                <button onClick={() => { setQuoteForPolicy(undefined); setShowAddPolicy(true); }} className="mb-4 px-4 py-2 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700">Добавить полис</button>
                
                <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50">
                            <tr>
                                {headers.map(header => (
                                    <th key={header.key} scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                                        {header.key === 'payments' ? (
                                            header.label
                                        ) : (
                                            <button onClick={() => requestPolicySort(header.key)} className="flex items-center w-full text-left focus:outline-none">
                                                {header.label}
                                                <SortIcon direction={getPolicySortDirection(header.key)} />
                                            </button>
                                        )}
                                    </th>
                                ))}
                                <th scope="col" className="relative px-4 py-3"><span className="sr-only">Действия</span></th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {sortedDealPolicies.map(policy => {
                                const policyPayments = payments.filter(p => p.policyId === policy.id);
                                return (
                                    <tr key={policy.id} className="hover:bg-slate-50 align-top">
                                        <td className="px-4 py-4 whitespace-nowrap text-sm">
                                            <div className="font-medium text-slate-900">{policy.policyNumber}</div>
                                            <div className="text-slate-500">{policy.type}</div>
                                            {policy.type === 'Авто' && <div className="text-xs text-slate-400 mt-1">{policy.carBrand} {policy.carModel}</div>}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{policy.counterparty}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">{policy.startDate}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-500">{policy.endDate}</td>
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-800 font-semibold">{formatCurrency(policy.policyPremium)}</td>
                                        <td className="px-4 py-4 text-sm text-slate-500">
                                            {policyPayments.length > 0 ? (
                                                <ul className="space-y-1">
                                                    {policyPayments.map(p => (
                                                        <li key={p.id} className="text-xs">
                                                            <span>{p.dueDate}: {formatCurrency(p.amount)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <span className="text-xs text-slate-400">Нет</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <PaymentStatusBadge statusInfo={policy.statusInfo} />
                                        </td>
                                        <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => { setPolicyForPayment(policy); setShowAddPayment(true); }} className="text-sky-600 hover:text-sky-900">Добавить платеж</button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                     {policies.length === 0 && <p className="text-center text-sm text-slate-500 py-8">Полисы по этой сделке еще не добавлены.</p>}
                </div>
            </div>
        );

      case 'Финансы':
        const totalIncome = dealFinancials.filter(f => f.type === 'Доход').reduce((sum, f) => sum + f.amount, 0);
        const totalExpense = dealFinancials.filter(f => f.type === 'Расход').reduce((sum, f) => sum + f.amount, 0);
        return (
            <div>
                 <button onClick={() => setShowAddFinancial(true)} className="mb-4 px-4 py-2 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700">Добавить операцию</button>
                 <div className="mb-6 grid grid-cols-3 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg"><span className="block text-sm text-green-800">Доход</span><span className="text-xl font-bold text-green-900">{formatCurrency(totalIncome)}</span></div>
                    <div className="bg-red-50 p-4 rounded-lg"><span className="block text-sm text-red-800">Расход</span><span className="text-xl font-bold text-red-900">{formatCurrency(totalExpense)}</span></div>
                    <div className="bg-blue-50 p-4 rounded-lg"><span className="block text-sm text-blue-800">Прибыль</span><span className="text-xl font-bold text-blue-900">{formatCurrency(totalIncome - totalExpense)}</span></div>
                 </div>
                 <ul className="space-y-2">
                  {dealFinancials.map(fin => (
                    <li key={fin.id} className={`flex justify-between items-center p-3 rounded-md ${fin.type === 'Доход' ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div>
                        <p className="font-medium text-slate-800">{fin.description}</p>
                        <p className="text-xs text-slate-500">{fin.date}</p>
                      </div>
                      <p className={`font-semibold ${fin.type === 'Доход' ? 'text-green-700' : 'text-red-700'}`}>{formatCurrency(fin.amount)}</p>
                    </li>
                  ))}
                 </ul>
            </div>
        )
        
      case 'Заметки':
        return (
          <div>
            <form onSubmit={handleNoteSubmit} className="mb-4">
              <textarea
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="Добавить заметку..."
                className="w-full border-slate-300 rounded-md"
                rows={3}
              />
              <button type="submit" className="mt-2 px-4 py-2 text-sm bg-sky-600 text-white rounded-md hover:bg-sky-700">Сохранить</button>
            </form>
            <div className="space-y-3">
              {deal.notes.map(note => (
                <div key={note.id} className={`p-3 rounded-md ${note.status === 'active' ? 'bg-yellow-50' : 'bg-slate-100 text-slate-500'}`}>
                  <p>{note.content}</p>
                  <div className="text-xs text-slate-400 mt-2 flex justify-between items-center">
                    <span>{note.createdAt}</span>
                    <button onClick={() => onUpdateNoteStatus(deal.id, note.id, note.status === 'active' ? 'archived' : 'active')}>
                      {note.status === 'active' ? 'Архивировать' : 'Восстановить'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'История':
          return (
              <ul className="space-y-4">
                  {deal.activityLog.map(log => (
                      <li key={log.id} className="flex items-start space-x-3">
                         <div className="bg-slate-200 rounded-full h-8 w-8 flex items-center justify-center flex-shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                         </div>
                         <div>
                            <p className="text-sm text-slate-700">{log.action}</p>
                            <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString('ru-RU')} - {log.user}</p>
                         </div>
                      </li>
                  ))}
              </ul>
          )

      default:
        return null;
    }
  };


  return (
    <div className="bg-white h-full flex flex-col overflow-hidden">
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
            {isEditingTitle ? (
                <input
                    type="text"
                    value={editingTitleValue}
                    onChange={(e) => setEditingTitleValue(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={handleTitleKeyDown}
                    className="text-3xl font-bold text-slate-800 bg-transparent border-b-2 border-sky-500 focus:outline-none w-full mr-4"
                    autoFocus
                />
            ) : (
                <div className="flex items-center group flex-1 min-w-0">
                    <h1 className="text-3xl font-bold text-slate-800 truncate" title={deal.title}>{deal.title}</h1>
                    <button 
                        onClick={() => setIsEditingTitle(true)}
                        className="ml-3 p-2 rounded-full text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 hover:text-sky-600 transition-opacity flex-shrink-0"
                        title="Редактировать название"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
            )}
        </div>
        <div className="mt-4 flex items-center">
            <div className="flex-1 min-w-0">
                 <div className="relative" ref={clientSelectorRef}>
                    <button
                        type="button"
                        onClick={() => setClientSelectorOpen(!isClientSelectorOpen)}
                        className="text-lg font-semibold text-slate-700 border-0 border-b-2 border-transparent appearance-none rounded-md focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-transparent hover:bg-slate-100 p-1 -ml-2 w-full text-left truncate cursor-pointer"
                        aria-label="Выбрать клиента"
                        aria-haspopup="listbox"
                        aria-expanded={isClientSelectorOpen}
                    >
                        {client.name}
                    </button>
                    {isClientSelectorOpen && (
                        <div className="absolute z-20 mt-1 w-full max-w-sm bg-white rounded-md shadow-lg border border-slate-200">
                            <div className="p-2 border-b border-slate-200">
                                <input
                                    type="text"
                                    placeholder="Поиск клиента..."
                                    autoFocus
                                    value={clientSearchQuery}
                                    onChange={(e) => setClientSearchQuery(e.target.value)}
                                    className="w-full bg-slate-50 border-slate-200 rounded-md text-sm p-2 focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                                />
                            </div>
                            <ul className="max-h-52 overflow-auto text-base py-1" role="listbox">
                                {filteredClients.length > 0 ? (
                                    filteredClients.map((c) => (
                                    <li
                                        key={c.id}
                                        onClick={() => handleClientSelect(c.id)}
                                        className={`cursor-pointer select-none relative py-2 pl-3 pr-9 transition-colors ${
                                            c.id === client.id
                                                ? 'text-white bg-sky-600'
                                                : 'text-slate-900 hover:bg-slate-100'
                                        }`}
                                        role="option"
                                        aria-selected={c.id === client.id}
                                    >
                                        <span className="font-normal block truncate">{c.name}</span>
                                        {c.id === client.id && (
                                            <span className="text-white absolute inset-y-0 right-0 flex items-center pr-4">
                                                <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </span>
                                        )}
                                    </li>
                                ))) : (
                                     <li className="px-3 py-2 text-sm text-slate-500">Клиенты не найдены.</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>

                <div className="flex items-center space-x-4 text-sm text-slate-500 mt-1">
                    {client?.email && (
                        <a href={`mailto:${client.email}`} className="flex items-center space-x-1.5 hover:text-sky-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            <span>{client.email}</span>
                        </a>
                    )}
                    {client?.phone && (
                         <a href={`https://wa.me/${client.phone.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center space-x-1.5 hover:text-sky-600 transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 448 512" fill="currentColor"><path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zM223.9 439.6c-33.8 0-66.3-8.8-94.3-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/></svg>
                            <span>{client.phone}</span>
                        </a>
                    )}
                </div>
            </div>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
                <label htmlFor="deal-status" className="block text-xs font-medium text-slate-500">Статус</label>
                <select
                    id="deal-status"
                    value={deal.status}
                    onChange={handleStatusChange}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md"
                >
                    {DEAL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>
            <div>
                <span className="block text-xs font-medium text-slate-500">Продавец</span>
                <p className="mt-1 font-semibold text-slate-800 sm:text-sm py-2 px-1">{deal.owner}</p>
            </div>
            <div>
                <span className="block text-xs font-medium text-slate-500">Помощник</span>
                <p className="mt-1 font-semibold text-slate-800 sm:text-sm py-2 px-1">{deal.assistant || 'Не назначен'}</p>
            </div>
        </div>
      </div>
      
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 px-4">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                activeTab === tab
                  ? 'bg-white border-slate-200 border-t border-x text-sky-600'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
        {renderTabContent()}
      </div>

      {showAddQuote && <AddQuoteForm onAddQuote={(data) => onAddQuote(deal.id, data)} onClose={() => setShowAddQuote(false)} />}
      {showAddPolicy && <AddPolicyForm sourceQuote={quoteForPolicy} dealClientId={client.id} clients={allClients} onAddPolicy={(_dealId, policyData, installments, policyClientId) => onAddPolicy(deal.id, policyData, installments, policyClientId)} onClose={() => { setShowAddPolicy(false); setQuoteForPolicy(undefined); }} />}
      {policyForPayment && showAddPayment && <AddPaymentForm policyId={policyForPayment.id} onAddPayment={(data) => onAddPayment(policyForPayment.id, data)} onClose={() => { setShowAddPayment(false); setPolicyForPayment(null); }} />}
      {showAddFinancial && <AddFinancialTransactionForm dealId={deal.id} policies={policies} onAddTransaction={onAddFinancialTransaction} onClose={() => setShowAddFinancial(false)} />}
      {isCloseReasonModalOpen && <CloseDealModal onSubmit={handleCloseDealSubmit} onClose={() => { setCloseReasonModalOpen(false); setPendingStatusChange(null); }} />}
    </div>
  );
};
