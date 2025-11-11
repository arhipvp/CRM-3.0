import React, { useEffect, useMemo, useState } from "react";
import { Client, Deal, DealStatus, Payment, Policy, Task } from "../../types";
import { FileUploadManager } from "../FileUploadManager";

const statusLabels: Record<DealStatus, string> = {
  open: "В работе",
  won: "Выиграна",
  lost: "Закрыта (проиграна)",
  on_hold: "На паузе",
};

const DEAL_TABS = [
  { id: "overview", label: "Обзор" },
  { id: "tasks", label: "Задачи" },
  { id: "quotes", label: "Расчеты" },
  { id: "chat", label: "Чат" },
  { id: "files", label: "Файлы" },
  { id: "policies", label: "Полисы" },
  { id: "finance", label: "Финансы" },
  { id: "notes", label: "Заметки" },
  { id: "history", label: "История" },
] as const;

type DealTabId = (typeof DEAL_TABS)[number]["id"];

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("ru-RU") : "—");

const formatCurrency = (value?: string) => {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("ru-RU", { style: "currency", currency: "RUB" });
};

interface DealsViewProps {
  deals: Deal[];
  clients: Client[];
  policies: Policy[];
  payments: Payment[];
  tasks: Task[];
  selectedDealId: string | null;
  onSelectDeal: (dealId: string) => void;
  onUpdateStatus: (dealId: string, status: DealStatus) => Promise<void>;
  onRequestAddQuote: (dealId: string) => void;
  onRequestAddPolicy: (dealId: string) => void;
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
  onDeletePolicy: (policyId: string) => Promise<void>;
  onUploadDocument: (dealId: string, file: File) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
}

export const DealsView: React.FC<DealsViewProps> = ({
  deals,
  clients,
  policies,
  payments,
  tasks,
  selectedDealId,
  onSelectDeal,
  onUpdateStatus,
  onRequestAddQuote,
  onRequestAddPolicy,
  onDeleteQuote,
  onDeletePolicy,
  onUploadDocument,
  onDeleteDocument,
}) => {
  const selectedDeal = selectedDealId ? deals.find((deal) => deal.id === selectedDealId) ?? null : deals[0] ?? null;
  const selectedClient = selectedDeal ? clients.find((client) => client.id === selectedDeal.clientId) ?? null : null;

  const [activeTab, setActiveTab] = useState<DealTabId>("overview");

  useEffect(() => {
    setActiveTab("overview");
  }, [selectedDeal?.id]);

  const relatedPolicies = useMemo(
    () => (selectedDeal ? policies.filter((p) => p.dealId === selectedDeal.id) : []),
    [policies, selectedDeal],
  );
  const relatedPayments = useMemo(
    () => (selectedDeal ? payments.filter((p) => p.dealId === selectedDeal.id) : []),
    [payments, selectedDeal],
  );
  const relatedTasks = useMemo(
    () => (selectedDeal ? tasks.filter((t) => t.dealId === selectedDeal.id) : []),
    [selectedDeal, tasks],
  );

  const quotes = selectedDeal?.quotes ?? [];

  const renderTasksTab = () => {
    if (!relatedTasks.length) {
      return <p className="text-sm text-slate-500">Задачи еще не созданы.</p>;
    }
    return (
      <ul className="divide-y divide-slate-100">
        {relatedTasks.map((task) => (
          <li key={task.id} className="py-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900 text-sm">{task.title}</p>
                {task.description && <p className="text-sm text-slate-500 mt-1">{task.description}</p>}
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-4">
                  <span>Статус: {task.status}</span>
                  {task.dueAt && <span>Срок: {formatDate(task.dueAt)}</span>}
                </div>
              </div>
              {task.priority && (
                <span className="text-xs font-semibold text-slate-500 uppercase bg-slate-100 rounded-full px-2 py-1">
                  {task.priority}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
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

  const renderPaymentsTab = () => {
    if (!relatedPayments.length) {
      return <p className="text-sm text-slate-500">Платежей пока нет.</p>;
    }
    return (
      <div className="space-y-3">
        {relatedPayments.map((payment) => (
          <div key={payment.id} className="border border-slate-100 rounded-xl p-3 text-sm">
            <p className="font-semibold text-slate-900">{formatCurrency(payment.amount)}</p>
            <p className="text-slate-500">{payment.description || "Без описания"}</p>
            <p className="text-xs text-slate-400 mt-1">Запланировано: {formatDate(payment.scheduledDate)}</p>
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{quote.insuranceType}</p>
                  <p className="text-xs text-slate-500 mt-1">{quote.insurer}</p>
                </div>
                <button
                  className="text-xs text-slate-400 hover:text-red-500"
                  onClick={() => onDeleteQuote(selectedDeal.id, quote.id).catch(() => undefined)}
                >
                  Удалить
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-slate-600 mt-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Страховая сумма</p>
                  <p className="font-semibold">{formatCurrency(quote.sumInsured)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Премия</p>
                  <p className="font-semibold">{formatCurrency(quote.premium)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400">Франшиза</p>
                  <p className="font-semibold">{quote.deductible || "—"}</p>
                </div>
              </div>
              {quote.comments && <p className="text-sm text-slate-500 mt-3">{quote.comments}</p>}
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

  const renderPlaceholder = (label: string) => (
    <div className="text-sm text-slate-500">{label} появится после имплементации соответствующей фичи.</div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Клиент</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{selectedClient?.name || "Не указан"}</p>
                {selectedClient?.phone && <p className="text-sm text-slate-500 mt-1">{selectedClient.phone}</p>}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">Следующий контакт</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{formatDate(selectedDeal?.nextReviewDate)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">План закрытия</p>
                <p className="text-lg font-semibold text-slate-900 mt-1">{formatDate(selectedDeal?.expectedClose)}</p>
              </div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
              {selectedDeal?.description ? <p>{selectedDeal.description}</p> : <p>Описание сделки не заполнено.</p>}
            </div>
          </div>
        );
      case "tasks":
        return renderTasksTab();
      case "policies":
        return renderPoliciesTab();
      case "finance":
        return renderPaymentsTab();
      case "quotes":
        return renderQuotesTab();
      case "files":
        return renderFilesTab();
      case "chat":
        return renderPlaceholder("Чат");
      case "notes":
        return renderPlaceholder("Заметки");
      case "history":
        return renderPlaceholder("История активности");
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
            <p className="text-lg font-semibold text-slate-900">{deals.length}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {deals.map((deal) => (
            <button
              key={deal.id}
              onClick={() => onSelectDeal(deal.id)}
              className={`w-full text-left px-5 py-4 border-b border-slate-100 transition ${
                selectedDeal?.id === deal.id ? "bg-sky-50" : "hover:bg-slate-50"
              }`}
            >
              <p className="text-sm font-semibold text-slate-900">{deal.title}</p>
              <p className="text-xs text-slate-500 mt-1">{statusLabels[deal.status]}</p>
              <p className="text-xs text-slate-400 mt-1">Клиент: {deal.clientName || "—"}</p>
            </button>
          ))}
          {!deals.length && <p className="p-6 text-sm text-slate-500">Сделок пока нет</p>}
        </div>
      </section>

      <section className="xl:col-span-3 space-y-6">
        {selectedDeal ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <p className="text-sm text-slate-500">Сделка</p>
                <h2 className="text-2xl font-semibold text-slate-900">{selectedDeal.title}</h2>
                <p className="text-sm text-slate-500 mt-1">{selectedClient?.name || "Клиент не выбран"}</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600">Статус</label>
                <select
                  value={selectedDeal.status}
                  onChange={(event) => onUpdateStatus(selectedDeal.id, event.target.value as DealStatus)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option value={value} key={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Вероятность</p>
                <p className="text-lg font-semibold">{selectedDeal.probability}%</p>
              </div>
              <div>
                <p className="text-slate-500">Источник</p>
                <p className="text-lg font-semibold">{selectedDeal.source || "—"}</p>
              </div>
              <div>
                <p className="text-slate-500">Канал</p>
                <p className="text-lg font-semibold">{selectedDeal.channel || "—"}</p>
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
                        ? "bg-white text-sky-600 border border-b-white border-slate-200"
                        : "text-slate-500 hover:text-slate-700"
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
    </div>
  );
};
