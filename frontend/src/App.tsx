import React, { useCallback, useEffect, useState } from "react";
import { MainLayout, View } from "./components/MainLayout";
import { Modal } from "./components/Modal";
import { ClientForm } from "./components/forms/ClientForm";
import { DealForm } from "./components/forms/DealForm";
import { DealsView } from "./components/views/DealsView";
import { ClientsView } from "./components/views/ClientsView";
import { PoliciesView } from "./components/views/PoliciesView";
import { PaymentsView } from "./components/views/PaymentsView";
import { FinanceView } from "./components/views/FinanceView";
import { TasksView } from "./components/views/TasksView";
import { SettingsView } from "./components/views/SettingsView";
import { AddQuoteForm, QuoteFormValues } from "./components/forms/AddQuoteForm";
import { AddPolicyForm, PolicyFormValues } from "./components/forms/AddPolicyForm";
import {
  createClient,
  createDeal,
  createQuote,
  createPolicy,
  createPayment,
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
  updateDealStatus,
  updateDeal,
  updatePayment,
  fetchActivityLogs,
  createTask,
  updateTask,
  deleteTask,
} from "./api";
import { Client, Deal, DealStatus, Payment, Policy, Task } from "./types";

type ModalType = null | "client" | "deal";

const App: React.FC = () => {
  const [view, setView] = useState<View>("deals");
  const [modal, setModal] = useState<ModalType>(null);
  const [quoteDealId, setQuoteDealId] = useState<string | null>(null);
  const [policyDealId, setPolicyDealId] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [isSyncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [clientsData, dealsData, policiesData, paymentsData, tasksData] = await Promise.all([
        fetchClients(),
        fetchDeals(),
        fetchPolicies(),
        fetchPayments(),
        fetchTasks(),
      ]);
      setClients(clientsData);
      setDeals(dealsData);
      setPolicies(policiesData);
      setPayments(paymentsData);
      setTasks(tasksData);
      setSelectedDealId((prev) => prev ?? (dealsData[0]?.id ?? null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddClient = async (data: { name: string; phone?: string; birthDate?: string | null; notes?: string | null }) => {
    const created = await createClient(data);
    setClients((prev) => [created, ...prev]);
    setModal(null);
  };

  const handleAddDeal = async (data: { title: string; clientId: string; description?: string; expectedClose?: string | null }) => {
    const created = await createDeal(data);
    setDeals((prev) => [created, ...prev]);
    setSelectedDealId(created.id);
    setModal(null);
  };

  const handleMarkPayment = async (paymentId: string) => {
    const today = new Date().toISOString().split("T")[0];
    const updated = await updatePayment(paymentId, { status: "paid", actualDate: today });
    setPayments((prev) => prev.map((payment) => (payment.id === updated.id ? updated : payment)));
  };

  const handleStatusChange = async (dealId: string, status: DealStatus) => {
    setSyncing(true);
    try {
      const updated = await updateDealStatus(dealId, status);
      setDeals((prev) => prev.map((deal) => (deal.id === updated.id ? updated : deal)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось обновить статус");
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
      setError(err instanceof Error ? err.message : "Не удалось обновить сделку");
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
          deal.id === dealId ? { ...deal, quotes: [created, ...(deal.quotes ?? [])] } : deal,
        ),
      );
      setQuoteDealId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить расчет");
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
            : deal,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить расчет");
      throw err;
    }
  };

  const handleAddPolicy = async (dealId: string, values: PolicyFormValues) => {
    try {
      const created = await createPolicy({ dealId, ...values });
      setPolicies((prev) => [created, ...prev]);

      // Создать платеж, если указано
      if (values.createPayment && values.paymentAmount) {
        const payment = await createPayment({
          dealId,
          policyId: created.id,
          amount: values.paymentAmount,
          description: values.paymentDescription || `Платеж по полису ${values.number}`,
          status: "planned",
        });
        setPayments((prev) => [payment, ...prev]);
      }

      setPolicyDealId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить полис");
      throw err;
    }
  };

  const handleDeletePolicy = async (policyId: string) => {
    try {
      await deletePolicy(policyId);
      setPolicies((prev) => prev.filter((policy) => policy.id !== policyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить полис");
      throw err;
    }
  };

  const handleUploadDocument = async (dealId: string, file: File) => {
    try {
      await uploadDocument(dealId, file);
      // Перезагрузить сделки, чтобы получить обновленный список документов
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить файл");
      throw err;
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument(documentId);
      // Перезагрузить сделки, чтобы получить обновленный список документов
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить файл");
      throw err;
    }
  };

  const handleFetchChatMessages = async (dealId: string) => {
    try {
      return await fetchChatMessages(dealId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить сообщения");
      throw err;
    }
  };

  const handleSendChatMessage = async (dealId: string, authorName: string, body: string) => {
    try {
      await createChatMessage(dealId, authorName, body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отправить сообщение");
      throw err;
    }
  };

  const handleDeleteChatMessage = async (messageId: string) => {
    try {
      await deleteChatMessage(messageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить сообщение");
      throw err;
    }
  };

  const handleCreateTask = async (dealId: string, data: any) => {
    setSyncing(true);
    try {
      const created = await createTask({ dealId, ...data });
      setTasks((prev) => [created, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать задачу");
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
      setError(err instanceof Error ? err.message : "Не удалось обновить задачу");
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
      setError(err instanceof Error ? err.message : "Не удалось удалить задачу");
      throw err;
    }
  };

  const renderView = () => {
    if (isLoading) {
      return <p className="text-sm text-slate-500">Загружаем данные из backend...</p>;
    }
    switch (view) {
      case "deals":
        return (
          <DealsView
            deals={deals}
            clients={clients}
            policies={policies}
            payments={payments}
            tasks={tasks}
            selectedDealId={selectedDealId}
            onSelectDeal={setSelectedDealId}
            onUpdateStatus={handleStatusChange}
            onUpdateDeal={handleUpdateDeal}
            onRequestAddQuote={(dealId) => setQuoteDealId(dealId)}
            onRequestAddPolicy={(dealId) => setPolicyDealId(dealId)}
            onDeleteQuote={handleDeleteQuote}
            onDeletePolicy={handleDeletePolicy}
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
      case "clients":
        return <ClientsView clients={clients} deals={deals} />;
      case "policies":
        return <PoliciesView policies={policies} deals={deals} />;
      case "payments":
        return <PaymentsView payments={payments} deals={deals} onMarkPaid={handleMarkPayment} />;
      case "finance":
        return <FinanceView payments={payments} />;
      case "tasks":
        return <TasksView tasks={tasks} deals={deals} />;
      case "settings":
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <MainLayout
      activeView={view}
      onNavigate={setView}
      onAddDeal={() => setModal("deal")}
      onAddClient={() => setModal("client")}
    >
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Рабочее место</h1>
            <p className="text-sm text-slate-500">Данные синхронизируются с Django API</p>
          </div>
          <button onClick={loadData} className="text-sm text-sky-600 font-semibold hover:text-sky-800" disabled={isLoading}>
            Обновить данные
          </button>
        </div>
        {error && <p className="text-sm text-red-500 bg-red-50 p-3 rounded-xl">{error}</p>}
        {isSyncing && <p className="text-xs text-sky-600">Обновляем статус сделки...</p>}
        {renderView()}
      </div>

      {modal === "client" && (
        <Modal title="Новый клиент" onClose={() => setModal(null)}>
          <ClientForm onSubmit={handleAddClient} submitLabel="Создать клиента" />
        </Modal>
      )}
      {modal === "deal" && (
        <Modal title="Новая сделка" onClose={() => setModal(null)}>
          <DealForm onSubmit={handleAddDeal} clients={clients} />
        </Modal>
      )}
      {quoteDealId && (
        <Modal title="Новый расчет" onClose={() => setQuoteDealId(null)}>
          <AddQuoteForm onSubmit={(values) => handleAddQuote(quoteDealId, values)} onCancel={() => setQuoteDealId(null)} />
        </Modal>
      )}
      {policyDealId && (
        <Modal title="Новый полис" onClose={() => setPolicyDealId(null)}>
          <AddPolicyForm onSubmit={(values) => handleAddPolicy(policyDealId, values)} onCancel={() => setPolicyDealId(null)} />
        </Modal>
      )}
    </MainLayout>
  );
};

export default App;



