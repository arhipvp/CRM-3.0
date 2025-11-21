import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MainLayout } from './components/MainLayout';
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
import { KnowledgeDocumentsView } from './components/views/KnowledgeDocumentsView';
import { AddQuoteForm, QuoteFormValues } from './components/forms/AddQuoteForm';
import { AddPolicyForm, PolicyFormValues } from './components/forms/AddPolicyForm';
import { AddPaymentForm, AddPaymentFormValues } from './components/forms/AddPaymentForm';
import {
  AddFinancialRecordForm,
  AddFinancialRecordFormValues,
} from './components/forms/AddFinancialRecordForm';
import type { AddTaskFormValues } from './components/forms/AddTaskForm';
import type { EditDealFormValues } from './components/forms/EditDealForm';
import {
  createClient,
  updateClient,
  createDeal,
  createQuote,
  updateQuote,
  createPolicy,
  createPayment,
  createFinancialRecord,
  updateFinancialRecord,
  deleteFinancialRecord,
  deleteQuote,
  deletePolicy,
  fetchChatMessages,
  createChatMessage,
  deleteChatMessage,
  updateDealStatus,
  updateDeal,
  updatePayment,
  fetchDealHistory,
  createTask,
  updateTask,
  deleteTask,
  getCurrentUser,
  clearTokens,
  APIError,
  uploadKnowledgeDocument,
} from './api';
import type { CurrentUserResponse } from './api';
import { Client, DealStatus, FinancialRecord, Payment, Quote, User } from './types';
import { useAppData } from './hooks/useAppData';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useDealFilters } from './hooks/useDealFilters';

const normalizeStringValue = (value: unknown): string =>
  typeof value === 'string' ? value : value ? String(value) : '';

const normalizeDateValue = (value: unknown): string => {
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return '';
};

const buildPolicyDraftFromRecognition = (
  parsed: Record<string, unknown>
): PolicyFormValues => {
  const policy = (parsed.policy ?? {}) as Record<string, unknown>;
  const paymentsRaw = Array.isArray(parsed.payments)
    ? (parsed.payments as Record<string, unknown>[])
    : [];
  const payments =
    paymentsRaw.length > 0
      ? paymentsRaw.map((payment) => ({
        amount: normalizeStringValue(payment.amount),
        description: '',
        scheduledDate: normalizeDateValue(payment.payment_date),
        actualDate: normalizeDateValue(payment.actual_payment_date),
        incomes: [],
        expenses: [],
      }))
      : [
        {
          amount: '',
          description: '',
          scheduledDate: '',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
      ];

  return {
    number: normalizeStringValue(policy.policy_number),
    insuranceCompanyId: '',
    insuranceTypeId: '',
    isVehicle: Boolean(policy.vehicle_brand || policy.vehicle_model || policy.vehicle_vin),
    brand: normalizeStringValue(policy.vehicle_brand),
    model: normalizeStringValue(policy.vehicle_model),
    vin: normalizeStringValue(policy.vehicle_vin),
    counterparty: normalizeStringValue(policy.contractor),
    startDate: normalizeDateValue(policy.start_date) || null,
    endDate: normalizeDateValue(policy.end_date) || null,
    payments,
  };
};

const resolveRoleNames = (userData: CurrentUserResponse): string[] => {
  const parsed = userData.user_roles
    ?.map((ur) => ur.role?.name)
    .filter((name): name is string => Boolean(name)) ?? [];
  if (parsed.length > 0) {
    return parsed;
  }
  return userData.roles ?? [];
};

const mapApiUser = (userData: CurrentUserResponse): User => ({
  id: String(userData.id),
  username: userData.username,
  roles: resolveRoleNames(userData),
  firstName: userData.first_name ?? undefined,
  lastName: userData.last_name ?? undefined,
});

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
  const [modal, setModal] = useState<ModalType>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [quoteDealId, setQuoteDealId] = useState<string | null>(null);
  const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
  const [policyDealId, setPolicyDealId] = useState<string | null>(null);
  const [policyPrefill, setPolicyPrefill] = useState<{
    values: PolicyFormValues;
    insuranceCompanyName?: string;
    insuranceTypeName?: string;
  } | null>(null);
  const [paymentModal, setPaymentModal] = useState<PaymentModalState | null>(null);
  const [financialRecordModal, setFinancialRecordModal] =
    useState<FinancialRecordModalState | null>(null);
  const {
    dataState,
    loadData,
    refreshDeals,
    refreshKnowledgeDocuments,
    updateAppData,
    setAppData,
    isLoading,
    isSyncing,
    setIsSyncing,
    error,
    setError,
  } = useAppData();
  const {
    clients,
    deals,
    policies,
    salesChannels,
    payments,
    financialRecords,
    tasks,
    users,
    knowledgeDocs,
    knowledgeLoading,
    knowledgeError,
    knowledgeUploading,
  } = dataState;
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const {
    dealSearch,
    setDealSearch,
    dealExecutorFilter,
    setDealExecutorFilter,
    dealSourceFilter,
    setDealSourceFilter,
    dealExpectedCloseFrom,
    setDealExpectedCloseFrom,
    dealExpectedCloseTo,
    setDealExpectedCloseTo,
    filters: dealFilters,
  } = useDealFilters();
  const searchInitialized = useRef(false);
  const location = useLocation();

  const refreshDealsWithSelection = useCallback(
    async (filters?: FilterParams) => {
      const dealsData = await refreshDeals(filters);
      setSelectedDealId((prev) => {
        if (prev && dealsData.some((deal) => deal.id === prev)) {
          return prev;
        }
        return dealsData[0]?.id ?? null;
      });
      return dealsData;
    },
    [refreshDeals]
  );

  const handlePolicyDraftReady = useCallback(
    (dealId: string, parsed: Record<string, unknown>) => {
      if (!parsed) {
        return;
      }
      const draft = buildPolicyDraftFromRecognition(parsed);
      const policyObj = (parsed.policy ?? {}) as Record<string, unknown>;
      const recognizedSalesChannel = normalizeStringValue(policyObj.sales_channel);
      const matchedChannel = salesChannels.find(
        (channel) => channel.name.toLowerCase() === recognizedSalesChannel.toLowerCase()
      );
      const values = {
        ...draft,
        salesChannelId: matchedChannel?.id,
      };
      setPolicyDealId(dealId);
      setPolicyPrefill({
        values,
        insuranceCompanyName: normalizeStringValue(policyObj.insurance_company),
        insuranceTypeName: normalizeStringValue(policyObj.insurance_type),
      });
    },
    [salesChannels]
  );

  const debouncedDealFilters = useDebouncedValue(dealFilters, 300);

  useEffect(() => {
    if (!isAuthenticated) {
      searchInitialized.current = false;
      return;
    }

    if (!searchInitialized.current) {
      searchInitialized.current = true;
      return;
    }

    setError(null);
    refreshDealsWithSelection(debouncedDealFilters).catch((err) => {
      console.error('Search deals error:', err);
      setError(err instanceof Error ? err.message : 'Ошибка при поиске сделок');
    });
  }, [
    debouncedDealFilters,
    refreshDealsWithSelection,
    isAuthenticated,
    setError,
  ]);
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    if (location.pathname === '/knowledge') {
      refreshKnowledgeDocuments();
    }
  }, [isAuthenticated, refreshKnowledgeDocuments, location.pathname]);

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
        const user = mapApiUser(userData);
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
    updateAppData((prev) => ({ clients: [created, ...prev.clients] }));
    setModal(null);
  };

  const handleEditClient = (client: Client) => {
    setModal(null);
    setEditingClient(client);
  };

  const handleUpdateClient = async (
    clientId: string,
    data: {
      name: string;
      phone?: string;
      birthDate?: string | null;
      notes?: string | null;
    }
  ) => {
    const updated = await updateClient(clientId, data);
    updateAppData((prev) => ({
      clients: prev.clients.map((client) => (client.id === updated.id ? updated : client)),
      deals: prev.deals.map((deal) =>
        deal.clientId === updated.id ? { ...deal, clientName: updated.name } : deal
      ),
    }));
    setEditingClient(null);
  };

  const handleAddDeal = async (data: {
    title: string;
    clientId: string;
    description?: string;
    expectedClose?: string | null;
    executorId?: string | null;
    source?: string;
  }) => {
    const created = await createDeal({
      title: data.title,
      clientId: data.clientId,
      description: data.description,
      expectedClose: data.expectedClose,
      executorId: data.executorId,
      source: data.source,
    });
    updateAppData((prev) => ({ deals: [created, ...prev.deals] }));
    setSelectedDealId(created.id);
    setModal(null);
  };

  const handleMarkPayment = async (paymentId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const updated = await updatePayment(paymentId, { actualDate: today });
    updateAppData((prev) => ({ payments: prev.payments.map((payment) => (payment.id === updated.id ? updated : payment)) }));
  };

  const handleKnowledgeUpload = useCallback(
    async (file: File, metadata: { title?: string; description?: string }) => {
      setAppData({ knowledgeUploading: true });
      try {
        await uploadKnowledgeDocument(file, metadata);
        await refreshKnowledgeDocuments();
      } catch (err) {
        const message = err instanceof Error ? err : new Error('Ошибка при загрузке справочной базы');
        throw message;
      } finally {
        setAppData({ knowledgeUploading: false });
      }
    },
    [refreshKnowledgeDocuments, setAppData]
  );

  const handleStatusChange = async (dealId: string, status: DealStatus) => {
    setIsSyncing(true);
    try {
      const updated = await updateDealStatus(dealId, status);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) => (deal.id === updated.id ? updated : deal)),
      }));
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка при обновлении статуса сделки';
      setError(message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateDeal = async (dealId: string, data: EditDealFormValues) => {
    setIsSyncing(true);
    try {
      const updated = await updateDeal(dealId, data);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) => (deal.id === updated.id ? updated : deal)),
      }));
      setSelectedDealId(updated.id);
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Ошибка доступа при обновлении сделки', 'error', 4000);
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка при обновлении сделки');
      }
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddQuote = async (dealId: string, values: QuoteFormValues) => {
    try {
      const created = await createQuote({ dealId, ...values });
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) =>
          deal.id === dealId ? { ...deal, quotes: [created, ...(deal.quotes ?? [])] } : deal
        ),
      }));
      setQuoteDealId(null);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка при добавлении предложения';
      setError(message);
      throw err;
    }
  };

  const handleUpdateQuote = async (values: QuoteFormValues) => {
    if (!editingQuote) {
      return;
    }
    const { id, dealId } = editingQuote;
    try {
      const updated = await updateQuote(id, values);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) =>
          deal.id === dealId
            ? {
              ...deal,
              quotes: deal.quotes
                ? deal.quotes.map((quote) => (quote.id === id ? updated : quote))
                : [updated],
            }
            : deal
        ),
      }));
      setEditingQuote(null);
    } catch (err) {
      const message =
        err instanceof APIError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Ошибка при обновлении предложения';
      setError(message);
      throw err;
    }
  };

  const handleRequestEditQuote = (quote: Quote) => {
    setEditingQuote(quote);
  };

  const handleDeleteQuote = async (dealId: string, quoteId: string) => {
    try {
      await deleteQuote(quoteId);
      updateAppData((prev) => ({
        deals: prev.deals.map((deal) =>
          deal.id === dealId
            ? { ...deal, quotes: deal.quotes?.filter((quote) => quote.id !== quoteId) ?? [] }
            : deal
        ),
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении предложения');
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
      salesChannelId,
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
        salesChannelId,
        brand,
        model,
        vin,
        startDate,
        endDate,
      });
      updateAppData((prev) => ({ policies: [created, ...prev.policies] }));

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
        });
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

        const paymentWithRecords: Payment = {
          ...payment,
          financialRecords: createdRecords.length
            ? [...createdRecords, ...(payment.financialRecords ?? [])]
            : payment.financialRecords,
        };
        updateAppData((prev) => ({
          payments: [paymentWithRecords, ...prev.payments],
          financialRecords:
            createdRecords.length > 0
              ? [...createdRecords, ...prev.financialRecords]
              : prev.financialRecords,
        }));
      }

      setPolicyDealId(null);
      setPolicyPrefill(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить полис');
      throw err;
    }
  };
  const handleDeletePolicy = async (policyId: string) => {
    try {
      await deletePolicy(policyId);
      updateAppData((prev) => ({ policies: prev.policies.filter((policy) => policy.id !== policyId) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить полис');
      throw err;
    }
  };

  const handleDriveFolderCreated = (dealId: string, folderId: string) => {
    updateAppData((prev) => ({
      deals: prev.deals.map((deal) =>
        deal.id === dealId ? { ...deal, driveFolderId: folderId } : deal
      ),
    }));
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

  const handleCreateTask = async (dealId: string, data: AddTaskFormValues) => {
    setIsSyncing(true);
    try {
      const created = await createTask({ dealId, ...data });
      updateAppData((prev) => ({ tasks: [created, ...prev.tasks] }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании задачи');
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateTask = async (taskId: string, data: Partial<AddTaskFormValues>) => {
    setIsSyncing(true);
    try {
      const updated = await updateTask(taskId, data);
      updateAppData((prev) => ({
        tasks: prev.tasks.map((task) => (task.id === updated.id ? updated : task)),
      }));
    } catch (err) {
      if (err instanceof APIError && err.status === 403) {
        addNotification('Ошибка доступа при обновлении задачи', 'error', 4000);
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка при обновлении задачи');
      }
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      updateAppData((prev) => ({ tasks: prev.tasks.filter((task) => task.id !== taskId) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении задачи');
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
      });

      const zeroIncome = await createFinancialRecord({
        paymentId: created.id,
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        description: 'Счёт: автоматически создан для учета',
        source: 'Система',
      });

      updateAppData((prev) => ({
        payments: [created, ...prev.payments],
        financialRecords: [zeroIncome, ...prev.financialRecords],
      }));
      setPaymentModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании платежа');
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
      });
      updateAppData((prev) => ({
        payments: prev.payments.map((payment) => (payment.id === updated.id ? updated : payment)),
      }));
      setPaymentModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении платежа');
      throw err;
    }
  };

  const handleAddFinancialRecord = async (values: AddFinancialRecordFormValues) => {
    const paymentId = values.paymentId || financialRecordModal?.paymentId;
    if (!paymentId) {
      return;
    }
    try {
      const created = await createFinancialRecord({
        paymentId: paymentId,
        amount: parseFloat(values.amount),
        date: values.date || null,
        description: values.description,
        source: values.source,
        note: values.note,
      });
      updateAppData((prev) => ({ financialRecords: [created, ...prev.financialRecords] }));
      setFinancialRecordModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании записи');
      throw err;
    }
  };

  const handleUpdateFinancialRecord = async (recordId: string, values: AddFinancialRecordFormValues) => {
    try {
      const updated = await updateFinancialRecord(recordId, {
        amount: parseFloat(values.amount),
        date: values.date || null,
        description: values.description,
        source: values.source,
        note: values.note,
      });
      updateAppData((prev) => ({
        financialRecords: prev.financialRecords.map((record) =>
          record.id === updated.id ? updated : record
        ),
      }));
      setFinancialRecordModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при обновлении записи');
      throw err;
    }
  };

  const handleDeleteFinancialRecord = async (recordId: string) => {
    try {
      await deleteFinancialRecord(recordId);
      updateAppData((prev) => ({
        financialRecords: prev.financialRecords.filter((record) => record.id !== recordId),
      }));
      setFinancialRecordModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении записи');
      throw err;
    }
  };

  const handleLogout = () => {
    clearTokens();
    setCurrentUser(null);
    setIsAuthenticated(false);
    setAppData({
      clients: [],
      deals: [],
      policies: [],
      salesChannels: [],
      payments: [],
      financialRecords: [],
      tasks: [],
      users: [],
      knowledgeDocs: [],
      knowledgeLoading: false,
      knowledgeError: null,
      knowledgeUploading: false,
    });
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-slate-500">
          {authLoading ? 'Загрузка...' : 'Загрузка данных...'}
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onLoginSuccess={async () => {
          const userData = await getCurrentUser();
          const user = mapApiUser(userData);
          setCurrentUser(user);
          setIsAuthenticated(true);
          await loadData();
        }}
      />
    );
  }

  return (
    <MainLayout
      onAddDeal={() => setModal('deal')}
      onAddClient={() => setModal('client')}
      currentUser={currentUser || undefined}
      onLogout={handleLogout}
    >
      <Routes>
        <Route
          path="/deals"
          element={
            <DealsView
              deals={deals}
              clients={clients}
              policies={policies}
              payments={payments}
              financialRecords={financialRecords}
              tasks={tasks}
              users={users}
              currentUser={currentUser as User}
              selectedDealId={selectedDealId}
              onSelectDeal={setSelectedDealId}
              onUpdateStatus={handleStatusChange}
              onUpdateDeal={handleUpdateDeal}
              onRequestAddQuote={(dealId) => setQuoteDealId(dealId)}
              onRequestEditQuote={handleRequestEditQuote}
              onRequestAddPolicy={(dealId) => setPolicyDealId(dealId)}
              onDeleteQuote={handleDeleteQuote}
              onDeletePolicy={handleDeletePolicy}
              onAddPayment={async (values) => {
                if (selectedDealId) await handleAddPayment({ ...values, dealId: selectedDealId });
              }}
              onUpdatePayment={handleUpdatePayment}
              onAddFinancialRecord={handleAddFinancialRecord}
              onUpdateFinancialRecord={handleUpdateFinancialRecord}
              onDeleteFinancialRecord={handleDeleteFinancialRecord}
              onDriveFolderCreated={handleDriveFolderCreated}
              onFetchChatMessages={handleFetchChatMessages}
              onSendChatMessage={handleSendChatMessage}
              onDeleteChatMessage={handleDeleteChatMessage}
              onFetchDealHistory={fetchDealHistory}
              onCreateTask={handleCreateTask}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={handleDeleteTask}
              dealSearch={dealSearch}
              onDealSearchChange={setDealSearch}
              dealExecutorFilter={dealExecutorFilter}
              onDealExecutorFilterChange={setDealExecutorFilter}
              dealSourceFilter={dealSourceFilter}
              onDealSourceFilterChange={setDealSourceFilter}
              dealExpectedCloseFrom={dealExpectedCloseFrom}
              onDealExpectedCloseFromChange={setDealExpectedCloseFrom}
              dealExpectedCloseTo={dealExpectedCloseTo}
              onDealExpectedCloseToChange={setDealExpectedCloseTo}
              onPolicyDraftReady={handlePolicyDraftReady}
            />
          }
        />
        <Route
          path="/clients"
          element={
            <ClientsView
              clients={clients}
              deals={deals}
              onClientEdit={handleEditClient}
            />
          }
        />
        <Route
          path="/policies"
          element={
            <PoliciesView
              policies={policies}
              deals={deals}
            />
          }
        />
        <Route
          path="/payments"
          element={
            <PaymentsView
              payments={payments}
              deals={deals}
              onMarkPaid={handleMarkPayment}
            />
          }
        />
        <Route
          path="/finance"
          element={
            <FinanceView
              financialRecords={financialRecords}
              payments={payments}
            />
          }
        />
        <Route
          path="/tasks"
          element={
            <TasksView
              tasks={tasks}
              deals={deals}
            />
          }
        />
        <Route
          path="/knowledge"
          element={
            <KnowledgeDocumentsView
              documents={knowledgeDocs}
              isLoading={knowledgeLoading}
              disabled={knowledgeUploading}
              error={knowledgeError}
              onUpload={handleKnowledgeUpload}
            />
          }
        />
        <Route path="/settings" element={<SettingsView />} />
        <Route path="*" element={<Navigate to="/deals" replace />} />
      </Routes>

      {/* Modals */}
      {modal === 'client' && (
        <Modal
          title="Новый клиент"
          onClose={() => setModal(null)}
        >
          <ClientForm onSubmit={handleAddClient} />
        </Modal>
      )}

      {editingClient && (
        <Modal
          title="Редактирование клиента"
          onClose={() => setEditingClient(null)}
        >
          <ClientForm
            initial={editingClient}
            onSubmit={(data) => handleUpdateClient(editingClient.id, data)}
          />
        </Modal>
      )}

      {modal === 'deal' && (
        <Modal
          title="Новая сделка"
          onClose={() => setModal(null)}
        >
          <DealForm
            clients={clients}
            users={users}
            onSubmit={handleAddDeal}
          />
        </Modal>
      )}

      {quoteDealId && (
        <Modal title="Добавить расчет" onClose={() => setQuoteDealId(null)}>
          <AddQuoteForm
            onSubmit={(values) => handleAddQuote(quoteDealId, values)}
            onCancel={() => setQuoteDealId(null)}
          />
        </Modal>
      )}

      {editingQuote && (
        <Modal title="Редактировать расчет" onClose={() => setEditingQuote(null)}>
          <AddQuoteForm
            initialValues={editingQuote}
            onSubmit={(values) => handleUpdateQuote(values)}
            onCancel={() => setEditingQuote(null)}
          />
        </Modal>
      )}

      {policyDealId && (
        <Modal title="Добавить полис" onClose={() => setPolicyDealId(null)} size="xl">
          <AddPolicyForm
            salesChannels={salesChannels}
            initialValues={policyPrefill?.values}
            initialInsuranceCompanyName={policyPrefill?.insuranceCompanyName}
            initialInsuranceTypeName={policyPrefill?.insuranceTypeName}
            onSubmit={(values) => handleAddPolicy(policyDealId, values)}
            onCancel={() => {
              setPolicyDealId(null);
              setPolicyPrefill(null);
            }}
          />
        </Modal>
      )}

      {paymentModal && (
        <Modal
          title="Редактировать платеж"
          onClose={() => setPaymentModal(null)}
        >
          <AddPaymentForm
            payment={payments.find((p) => p.id === paymentModal.paymentId)}
            onSubmit={(values) => handleUpdatePayment(paymentModal.paymentId!, values)}
            onCancel={() => setPaymentModal(null)}
          />
        </Modal>
      )}

      {financialRecordModal && (
        <Modal
          title="Редактировать запись"
          onClose={() => setFinancialRecordModal(null)}
        >
          <AddFinancialRecordForm
            paymentId={financialRecordModal.paymentId!}
            record={financialRecords.find((r) => r.id === financialRecordModal.recordId)}
            onSubmit={(values) =>
              handleUpdateFinancialRecord(financialRecordModal.recordId!, values)
            }
            onCancel={() => setFinancialRecordModal(null)}
          />
        </Modal>
      )}

      <NotificationDisplay />

      {error && (
        <div className="fixed bottom-4 left-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded z-50 max-w-md shadow-lg">
          <strong className="font-bold">Ошибка!</strong>
          <span className="block sm:inline"> {error}</span>
          <button className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={() => setError(null)}>
            <span className="text-2xl">&times;</span>
          </button>
        </div>
      )}

      {isSyncing && (
        <div className="fixed bottom-4 right-4 bg-blue-500 text-white px-4 py-2 rounded-full shadow-lg z-50 flex items-center gap-2">
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
          <span className="text-sm font-medium">Синхронизация...</span>
        </div>
      )}
    </MainLayout>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </BrowserRouter>
  );
};

export default App;
