import React from "react";
import { Client, Deal, DealStatus, Payment, Policy, Task } from "../../types";

const statusLabels: Record<DealStatus, string> = {
  open: "В работе",
  won: "Успешно",
  lost: "Закрыта (потеряна)",
  on_hold: "На паузе",
};

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("ru-RU") : "—");

interface DealsViewProps {
  deals: Deal[];
  clients: Client[];
  policies: Policy[];
  payments: Payment[];
  tasks: Task[];
  selectedDealId: string | null;
  onSelectDeal: (dealId: string) => void;
  onUpdateStatus: (dealId: string, status: DealStatus) => Promise<void>;
}

export const DealsView: React.FC<DealsViewProps> = ({ deals, clients, policies, payments, tasks, selectedDealId, onSelectDeal, onUpdateStatus }) => {
  const selectedDeal = selectedDealId ? deals.find((deal) => deal.id === selectedDealId) ?? null : deals[0] ?? null;
  const selectedClient = selectedDeal ? clients.find((client) => client.id === selectedDeal.clientId) ?? null : null;
  const relatedPolicies = selectedDeal ? policies.filter((p) => p.dealId === selectedDeal.id) : [];
  const relatedPayments = selectedDeal ? payments.filter((p) => p.dealId === selectedDeal.id) : [];
  const relatedTasks = selectedDeal ? tasks.filter((t) => t.dealId === selectedDeal.id) : [];

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
          <>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-500">Сделка</p>
                  <h2 className="text-2xl font-semibold text-slate-900">{selectedDeal.title}</h2>
                  <p className="text-sm text-slate-500 mt-1">{selectedClient?.name || "Без клиента"}</p>
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
              {selectedDeal.description && (
                <p className="text-sm text-slate-600 mt-4 leading-relaxed">{selectedDeal.description}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 text-sm">
                <div>
                  <p className="text-slate-500">Вероятность</p>
                  <p className="text-lg font-semibold">{selectedDeal.probability}%</p>
                </div>
                <div>
                  <p className="text-slate-500">Проверить до</p>
                  <p className="text-lg font-semibold">{formatDate(selectedDeal.nextReviewDate)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Закрытие</p>
                  <p className="text-lg font-semibold">{formatDate(selectedDeal.expectedClose)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Этап</p>
                  <p className="text-lg font-semibold">{selectedDeal.stageName || "—"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Полисы ({relatedPolicies.length})</h3>
                </div>
                {relatedPolicies.length ? (
                  <div className="space-y-3">
                    {relatedPolicies.map((policy) => (
                      <div key={policy.id} className="border border-slate-100 rounded-xl p-3">
                        <p className="text-sm font-semibold text-slate-900">{policy.number}</p>
                        <p className="text-xs text-slate-500">{policy.insuranceCompany}</p>
                        <p className="text-xs text-slate-400 mt-1">{policy.insuranceType}</p>
                        <p className="text-xs text-slate-400 mt-1">Статус: {policy.status}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Связанных полисов нет</p>
                )}
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold">Платежи ({relatedPayments.length})</h3>
                </div>
                {relatedPayments.length ? (
                  <div className="space-y-3">
                    {relatedPayments.map((payment) => (
                      <div key={payment.id} className="border border-slate-100 rounded-xl p-3 text-sm">
                        <p className="font-semibold text-slate-900">{Number(payment.amount).toLocaleString("ru-RU", { style: "currency", currency: "RUB" })}</p>
                        <p className="text-slate-500">{payment.description || "Без описания"}</p>
                        <p className="text-xs text-slate-400 mt-1">Плановая дата: {formatDate(payment.scheduledDate)}</p>
                        <p className="text-xs text-slate-400">Факт: {formatDate(payment.actualDate)}</p>
                        <p className="text-xs text-slate-500 mt-1">Статус: {payment.status}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Платежей пока нет</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Задачи ({relatedTasks.length})</h3>
              </div>
              {relatedTasks.length ? (
                <ul className="divide-y divide-slate-100">
                  {relatedTasks.map((task) => (
                    <li key={task.id} className="py-3">
                      <p className="font-semibold text-slate-900 text-sm">{task.title}</p>
                      {task.description && <p className="text-sm text-slate-500 mt-1">{task.description}</p>}
                      <div className="text-xs text-slate-400 mt-1 flex gap-4">
                        <span>Статус: {task.status}</span>
                        {task.dueAt && <span>Дедлайн: {formatDate(task.dueAt)}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">Активных задач нет</p>
              )}
            </div>
          </>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 text-sm text-slate-500">
            Добавьте первую сделку, чтобы увидеть детали
          </div>
        )}
      </section>
    </div>
  );
};
