import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MainLayout, View } from './components/MainLayout';
import { Modal } from './components/Modal';
import { LoginPage } from './components/LoginPage';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { NotificationDisplay } from './components/NotificationDisplay';
import { ClientForm } from './components/forms/ClientForm';
import { DealForm } from './components/forms/DealForm';
import { DealsView } from './components/views/DealsView';
import { ClientsView } from './components/views/ClientsView';
import { PoliciesView } from './components/views/PoliciesView';
import { PaymentsView } from './components/views/PaymentsView';
import { FinanceView } from './components/views/FinanceView';
import { TasksView } from './components/views/TasksView';
import { SettingsView } from './components/views/SettingsView';
import { AddQuoteForm, QuoteFormValues } from './components/forms/AddQuoteForm';
import { AddPolicyForm, PolicyFormValues } from './components/forms/AddPolicyForm';
import { AddPaymentForm, AddPaymentFormValues } from './components/forms/AddPaymentForm';
import {
  AddFinancialRecordForm,
  AddFinancialRecordFormValues,
} from './components/forms/AddFinancialRecordForm';
import {
  createClient,
  createDeal,
  createQuote,
  createPolicy,
  createPayment,
  createFinancialRecord,
  updateFinancialRecord,
  deleteQuote,
  deletePolicy,
  uploadDocument,
  deleteDocument,
  fetchChatMessages,
  createChatMessage,
  deleteChatMessage,
  fetchClients,
  fetchDeals,
  fetchPayments,
  fetchPolicies,
  fetchTasks,
  fetchFinancialRecords,
  fetchUsers,
  updateDealStatus,
  updateDeal,
  updatePayment,
  fetchActivityLogs,
  createTask,
  updateTask,
  deleteTask,
  getCurrentUser,
  clearTokens,
  APIError,
  FilterParams,
} from './api';
import { Client, Deal, DealStatus, FinancialRecord, Payment, Policy, Task, User } from './types';

type ModalType = null | 'client' | 'deal';

interface PaymentModalState {
  policyId?: string;
  paymentId?: string;
}

interface FinancialRecordModalState {
  paymentId?: string;
  recordId?: string;
}

const AppContent: React.FC = () => {
  const { addNotification } = useNotification();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>('deals');
  const [modal, setModal] = useState<ModalType>(null);
  const [quoteDealId, setQuoteDealId] = useState<string | null>(null);
  const [policyDealId, setPolicyDealId] = useState<string | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState | null>(null);
  const [financialRecordModal, setFinancialRecordModal] =
    useState<FinancialRecordModalState | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [dealSearch, setDealSearch] = useState('');
  const searchInitialized = useRef(false);
  const [isLoading, setLoading] = useState(true);
  const [isSyncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshDeals = useCallback(
    async (filters?: FilterParams) => {
      const resolvedFilters = { ordering: 'next_contact_date', ...(filters || {}) };
      const dealsData = await fetchDeals(resolvedFilters);
      setDeals(dealsData);
      setSelectedDealId((prev) => {
        if (prev && dealsData.some((deal) => deal.id === prev)) {
          return prev;
        }
        return dealsData[0]?.id ?? null;
      });
    },
    []
  );

  const loadData = useCallback(async () => {
    console.log('Loading data...');
    setLoading(true);
    setError(null);
    try {
      const dealsPromise = refreshDeals();
      const [
        clientsData,
        policiesData,
        paymentsData,
        tasksData,
        financialRecordsData,
        usersData,
      ] = await Promise.all([
        fetchClients(),
        fetchPolicies(),
        fetchPayments(),
        fetchTasks(),
        fetchFinancialRecords(),
        fetchUsers(),
      ]);
      await dealsPromise;
      console.log('Data loaded successfully:', {
        clientsData,
        policiesData,
        paymentsData,
        tasksData,
        financialRecordsData,
      });
      setClients(clientsData);
      setPolicies(policiesData);
      setPayments(paymentsData);
      setTasks(tasksData);
      setFinancialRecords(financialRecordsData);
      setUsers(usersData);
    } catch (err) {
      console.error('Data loading error:', err);
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные из backend');
    } finally {
      setLoading(false);
    }
  }, [refreshDeals]);


  useEffect(() => {
    if (!searchInitialized.current) {
      searchInitialized.current = true;
      return;
    }
    const handler = setTimeout(() => {
      const query = dealSearch.trim();
      const filters: FilterParams = { ordering: 'next_contact_date' };
      if (query) {
        filters.search = query;
      }
      setError(null);
      refreshDeals(filters).catch((err) => {
        console.error('Search deals error:', err);
        setError(err instanceof Error ? err.message : 'Не удалось найти сделки по запросу');
      });
    }, 300);
    return () => clearTimeout(handler);
  }, [dealSearch, refreshDeals]);

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking authentication...');
        const userData = await getCurrentUser();
        console.log('User data:', userData);
        if (!userData?.is_authenticated) {
          clearTokens();
          setCurrentUser(null);
          setIsAuthenticated(false);
          return;
        }
        // Parse roles from the API response structure
        const roles =
          userData.user_roles?.map((ur: any) => ur.role?.name).filter(Boolean) ||
          userData.roles ||
          [];
        const user: User = {
          id: String(userData.id),
          username: userData.username,
          roles: roles,
        };
        console.log('Setting current user:', user);
        setCurrentUser(user);
        setIsAuthenticated(true);
        await loadData();
      } catch (err) {
        console.error('Auth error:', err);
        setIsAuthenticated(false);
        setCurrentUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    checkAuth();
  }, [loadData]);

  const handleAddClient = async (data: {
    name: string;
    phone?: string;
    birthDate?: string | null;
    notes?: string | null;
  }) => {
    const created = await createClient(data);
    setClients((prev) => [created, ...prev]);
    setModal(null);
  };

  const handleAddDeal = async (data: {
    title: string;
    clientId: string;
    description?: string;
    expectedClose?: string | null;
  }) => {
    const created = await createDeal(data);
    setDeals((prev) => [created, ...prev]);
    setSelectedDealId(created.id);
    setModal(null);
  };

  const handleMarkPayment = async (paymentId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = await updatePayment(paymentId, { status: 'paid', actualDate: today });
    setPayments((prev) => prev.map((payment) => (payment.id === updated.id ? updated : payment)));
  };

  const handleStatusChange = async (dealId: string, status: DealStatus) => {
    setSyncing(true);
    try {
      const updated = await updateDealStatus(dealId, status);
      setDeals((prev) => prev.map((deal) => (deal.id === updated.id ? updated : deal)));
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось обновить статус';
      setError(message);
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateDeal = async (dealId: string, data: any) => {
    setSyncing(true);
    try {
      const updated = await updateDeal(dealId, data);
      setDeals((prev) => prev.map((deal) => (deal.id === updated.id ? updated : deal)));
      setSelectedDealId(updated.id);
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Только администратор может редактировать данные', 'error', 4000);
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось обновить сделку');
      }
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  const handleAddQuote = async (dealId: string, values: QuoteFormValues) => {
    try {
      const created = await createQuote({ dealId, ...values });
      setDeals((prev) =>
        prev.map((deal) =>
          deal.id === dealId ? { ...deal, quotes: [created, ...(deal.quotes ?? [])] } : deal
        )
      );
      setQuoteDealId(null);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Не удалось сохранить расчет';
      setError(message);
      throw err;
    }
  };

  const handleDeleteQuote = async (dealId: string, quoteId: string) => {
    try {
      await deleteQuote(quoteId);
      setDeals((prev) =>
        prev.map((deal) =>
          deal.id === dealId
            ? { ...deal, quotes: deal.quotes?.filter((quote) => quote.id !== quoteId) ?? [] }
            : deal
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить расчет');
      throw err;
    }
  };

  const handleAddPolicy = async (dealId: string, values: PolicyFormValues) => {
    const {
      number,
      insuranceCompanyId,
      insuranceTypeId,
      isVehicle,
      brand,
      model,
      vin,
      startDate,
      endDate,
      payments: paymentDrafts = [],
    } = values;
    const deal = deals.find((item) => item.id === dealId);
    const clientId = deal?.clientId;

    try {
      const created = await createPolicy({
        dealId,
        clientId,
        number,
        insuranceCompanyId,
        insuranceTypeId,
        isVehicle,
        brand,
        model,
        vin,
        startDate,
        endDate,
      });
      setPolicies((prev) => [created, ...prev]);

      for (const paymentDraft of paymentDrafts) {
        const amount = Number(paymentDraft.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          continue;
        }

        const payment = await createPayment({
          dealId,
          policyId: created.id,
          amount,
          description: paymentDraft.description,
          scheduledDate: paymentDraft.scheduledDate || null,
          actualDate: paymentDraft.actualDate || null,
          status: paymentDraft.status || 'planned',
        });
        setPayments((prev) => [payment, ...prev]);

        const createdRecords: FinancialRecord[] = [];

        for (const income of paymentDraft.incomes) {
          const incomeAmount = Number(income.amount);
          if (!Number.isFinite(incomeAmount) || incomeAmount <= 0) {
            continue;
          }

          const record = await createFinancialRecord({
            paymentId: payment.id,
            amount: incomeAmount,
            date: income.date || null,
            description: income.description,
            source: income.source,
            note: income.note,
          });
          createdRecords.push(record);
        }

        for (const expense of paymentDraft.expenses) {
          const expenseAmount = Number(expense.amount);
          if (!Number.isFinite(expenseAmount) || expenseAmount <= 0) {
            continue;
          }

          const record = await createFinancialRecord({
            paymentId: payment.id,
            amount: -Math.abs(expenseAmount),
            date: expense.date || null,
            description: expense.description,
            source: expense.source,
            note: expense.note,
          });
          createdRecords.push(record);
        }

        if (createdRecords.length) {
          setFinancialRecords((prev) => [...createdRecords, ...prev]);
          setPayments((prev) =>
            prev.map((existing) =>
              existing.id === payment.id
                ? {
                    ...existing,
                    financialRecords: [...createdRecords, ...(existing.financialRecords || [])],
                  }
                : existing
            )
          );
        }
      }

      setPolicyDealId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить полис');
      throw err;
    }
  };
  const handleDeletePolicy = async (policyId: string) => {
    try {
      await deletePolicy(policyId);
      setPolicies((prev) => prev.filter((policy) => policy.id !== policyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить полис');
      throw err;
    }
  };

  const handleUploadDocument = async (dealId: string, file: File) => {
    try {
      await uploadDocument(dealId, file);
      // Перезагрузить сделки, чтобы получить обновленный список документов
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить файл');
      throw err;
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument(documentId);
      // Перезагрузить сделки, чтобы получить обновленный список документов
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить файл');
      throw err;
    }
  };

  const handleFetchChatMessages = async (dealId: string) => {
    try {
      return await fetchChatMessages(dealId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить сообщения');
      throw err;
    }
  };

  const handleSendChatMessage = async (dealId: string, body: string) => {
    try {
      await createChatMessage(dealId, body);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
      throw err;
    }
  };

  const handleDeleteChatMessage = async (messageId: string) => {
    try {
      await deleteChatMessage(messageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить сообщение');
      throw err;
    }
  };

  const handleCreateTask = async (dealId: string, data: any) => {
    setSyncing(true);
    try {
      const created = await createTask({ dealId, ...data });
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать задачу');
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  const handleUpdateTask = async (taskId: string, data: any) => {
    setSyncing(true);
    try {
      const updated = await updateTask(taskId, data);
      setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Только администратор может редактировать данные', 'error', 4000);
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось обновить задачу');
      }
      throw err;
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить задачу');
      throw err;
    }
  };

  const handleAddPayment = async (values: AddPaymentFormValues) => {
    try {
      const created = await createPayment({
        policyId: values.policyId,
        dealId: values.dealId,
        amount: parseFloat(values.amount),
        description: values.description,
        scheduledDate: values.scheduledDate || null,
        actualDate: values.actualDate || null,
        status: values.status || 'planned',
      });

      // Auto-create zero-value income record for tracking
      const zeroIncome = await createFinancialRecord({
        paymentId: created.id,
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        description: 'Исходное значение (отслеживание)',
        source: 'Система',
      });

      setPayments((prev) => [created, ...prev]);
      setFinancialRecords((prev) => [zeroIncome, ...prev]);
      setPaymentModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать платеж');
      throw err;
    }
  };

  const handleUpdatePayment = async (paymentId: string, values: AddPaymentFormValues) => {
    try {
      const updated = await updatePayment(paymentId, {
        policyId: values.policyId,
        dealId: values.dealId,
        amount: parseFloat(values.amount),
        description: values.description,
        scheduledDate: values.scheduledDate || null,
        actualDate: values.actualDate || null,
        status: values.status || 'planned',
      });

      setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setPaymentModal(null);
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Только администратор может редактировать данные', 'error', 4000);
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось обновить платеж');
      }
      throw err;
    }
  };

  const handleAddFinancialRecord = async (values: AddFinancialRecordFormValues) => {
    try {
      // Convert recordType to signed amount
      const amount = parseFloat(values.amount) * (values.recordType === 'income' ? 1 : -1);

      const created = await createFinancialRecord({
        paymentId: values.paymentId,
        amount,
        date: values.date || null,
        description: values.description,
        source: values.source,
        note: values.note,
      });

      setFinancialRecords((prev) => [created, ...prev]);
      // Also update payments to reflect new financial record
      const paymentId = values.paymentId;
      setPayments((prev) =>
        prev.map((p) =>
          p.id === paymentId
            ? {
                ...p,
                financialRecords: [created, ...(p.financialRecords || [])],
              }
            : p
        )
      );
      setFinancialRecordModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать финансовую запись');
      throw err;
    }
  };

  const handleUpdateFinancialRecord = async (
    recordId: string,
    values: AddFinancialRecordFormValues
  ) => {
    try {
      // Convert recordType to signed amount
      const amount = parseFloat(values.amount) * (values.recordType === 'income' ? 1 : -1);

      const updated = await updateFinancialRecord(recordId, {
        amount,
        date: values.date || null,
        description: values.description,
        source: values.source,
        note: values.note,
      });

      setFinancialRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      // Also update in payments
      setPayments((prev) =>
        prev.map((p) => ({
          ...p,
          financialRecords: p.financialRecords?.map((r) => (r.id === updated.id ? updated : r)),
        }))
      );
      setFinancialRecordModal(null);
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Только администратор может редактировать данные', 'error', 4000);
      } else {
        setError(err instanceof Error ? err.message : 'Не удалось обновить финансовую запись');
      }
      throw err;
    }
  };

  const handleLogout = () => {
    clearTokens();
    setIsAuthenticated(false);
    setCurrentUser(null);
    setClients([]);
    setDeals([]);
    setPolicies([]);
    setPayments([]);
    setFinancialRecords([]);
    setTasks([]);
    setUsers([]);
  };

  const handleLoginSuccess = async () => {
    try {
      console.log('handleLoginSuccess: starting...');
      const userData = await getCurrentUser();
      console.log('handleLoginSuccess: got user data', userData);
      // Parse roles from the API response structure
      const roles =
        userData.user_roles?.map((ur: any) => ur.role?.name).filter(Boolean) ||
        userData.roles ||
        [];
      const user: User = {
        id: String(userData.id),
        username: userData.username,
        roles: roles,
        firstName: userData.first_name || undefined,
        lastName: userData.last_name || undefined,
      };
      setCurrentUser(user);
      setIsAuthenticated(true);
      // Load application data after successful login
      console.log('handleLoginSuccess: loading data...');
      await loadData();
      console.log('handleLoginSuccess: complete');
    } catch (err) {
      console.error('handleLoginSuccess: error', err);
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные пользователя');
      setIsAuthenticated(false);
    }
  };

  const renderView = () => {
    if (isLoading) {
      return <p className="text-sm text-slate-500">Загружаем данные из backend...</p>;
    }
    switch (view) {
      case 'deals':
        return (
          <DealsView
            deals={deals}
            clients={clients}
            policies={policies}
            payments={payments}
            financialRecords={financialRecords}
            tasks={tasks}
            users={users}
            currentUser={currentUser}
            selectedDealId={selectedDealId}
            onSelectDeal={setSelectedDealId}
            dealSearch={dealSearch}
            onDealSearchChange={setDealSearch}
            onUpdateStatus={handleStatusChange}
            onUpdateDeal={handleUpdateDeal}
            onRequestAddQuote={(dealId) => setQuoteDealId(dealId)}
            onRequestAddPolicy={(dealId) => setPolicyDealId(dealId)}
            onDeleteQuote={handleDeleteQuote}
            onDeletePolicy={handleDeletePolicy}
            onAddPayment={handleAddPayment}
            onUpdatePayment={handleUpdatePayment}
            onAddFinancialRecord={handleAddFinancialRecord}
            onUpdateFinancialRecord={handleUpdateFinancialRecord}
            onUploadDocument={handleUploadDocument}
            onDeleteDocument={handleDeleteDocument}
            onFetchChatMessages={handleFetchChatMessages}
            onSendChatMessage={handleSendChatMessage}
            onDeleteChatMessage={handleDeleteChatMessage}
            onFetchActivityLogs={fetchActivityLogs}
            onCreateTask={handleCreateTask}
            onUpdateTask={handleUpdateTask}
            onDeleteTask={handleDeleteTask}
          />
        );
      case 'clients':
        return <ClientsView clients={clients} deals={deals} />;
      case 'policies':
        return <PoliciesView policies={policies} deals={deals} />;
      case 'payments':
        return <PaymentsView payments={payments} deals={deals} onMarkPaid={handleMarkPayment} />;
      case 'finance':
        return <FinanceView payments={payments} financialRecords={financialRecords} />;
      case 'tasks':
        return <TasksView tasks={tasks} deals={deals} />;
      case 'settings':
        return <SettingsView />;
      default:
        return null;
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-sm text-slate-500">Проверяем аутентификацию...</p>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated || !currentUser) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <>
      <NotificationDisplay />
      <MainLayout
        activeView={view}
        onNavigate={setView}
        onAddDeal={() => setModal('deal')}
        onAddClient={() => setModal('client')}
        currentUser={currentUser}
        onLogout={handleLogout}
      >
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Рабочее место</h1>
              <p className="text-sm text-slate-500">Данные синхронизируются с Django API</p>
            </div>
            <button
              onClick={loadData}
              className="text-sm text-sky-600 font-semibold hover:text-sky-800"
              disabled={isLoading}
            >
              Обновить данные
            </button>
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-xl">{error}</p>}
          {isSyncing && <p className="text-xs text-sky-600">Обновляем статус сделки...</p>}
          {renderView()}
        </div>

        {modal === 'client' && (
          <Modal title="Новый клиент" onClose={() => setModal(null)}>
            <ClientForm onSubmit={handleAddClient} submitLabel="Создать клиента" />
          </Modal>
        )}
        {modal === 'deal' && (
          <Modal title="Новая сделка" onClose={() => setModal(null)}>
            <DealForm onSubmit={handleAddDeal} clients={clients} />
          </Modal>
        )}
        {quoteDealId && (
          <Modal title="Новый расчет" onClose={() => setQuoteDealId(null)}>
            <AddQuoteForm
              onSubmit={(values) => handleAddQuote(quoteDealId, values)}
              onCancel={() => setQuoteDealId(null)}
            />
          </Modal>
        )}
        {policyDealId && (
        <Modal
          title="Новый полис"
          onClose={() => setPolicyDealId(null)}
          closeOnOverlayClick={false}
        >
            <AddPolicyForm
              onSubmit={(values) => handleAddPolicy(policyDealId, values)}
              onCancel={() => setPolicyDealId(null)}
            />
          </Modal>
        )}
        {paymentModal && (
          <Modal
            title={paymentModal.paymentId ? 'Редактировать платеж' : 'Новый платеж'}
            onClose={() => setPaymentModal(null)}
          >
            <AddPaymentForm
              payment={
                paymentModal.paymentId
                  ? payments.find((p) => p.id === paymentModal.paymentId)
                  : undefined
              }
              onSubmit={(values) =>
                paymentModal.paymentId
                  ? handleUpdatePayment(paymentModal.paymentId, values)
                  : handleAddPayment(values)
              }
              onCancel={() => setPaymentModal(null)}
            />
          </Modal>
        )}
        {financialRecordModal && (
          <Modal
            title={
              financialRecordModal.recordId ? 'Редактировать запись' : 'Новая финансовая запись'
            }
            onClose={() => setFinancialRecordModal(null)}
          >
            <AddFinancialRecordForm
              paymentId={financialRecordModal.paymentId || ''}
              record={
                financialRecordModal.recordId
                  ? financialRecords.find((r) => r.id === financialRecordModal.recordId)
                  : undefined
              }
              onSubmit={(values) =>
                financialRecordModal.recordId
                  ? handleUpdateFinancialRecord(financialRecordModal.recordId, values)
                  : handleAddFinancialRecord(values)
              }
              onCancel={() => setFinancialRecordModal(null)}
            />
          </Modal>
        )}
      </MainLayout>
    </>
  );
};

const App: React.FC = () => {
  return (
    <NotificationProvider>
      <AppContent />
    </NotificationProvider>
  );
};

export default App;
