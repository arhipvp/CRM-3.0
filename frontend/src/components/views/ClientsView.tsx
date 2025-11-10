import React from "react";
import { Client, Deal } from "../../types";

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString("ru-RU") : "—");

interface ClientsViewProps {
  clients: Client[];
  deals: Deal[];
}

export const ClientsView: React.FC<ClientsViewProps> = ({ clients, deals }) => {
  const totals = {
    active: deals.length,
    clients: clients.length,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Клиентов</p>
          <p className="text-3xl font-semibold text-slate-900">{totals.clients}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Активных сделок</p>
          <p className="text-3xl font-semibold text-slate-900">{totals.active}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <p className="text-sm text-slate-500">Новых за 30 дней</p>
          <p className="text-3xl font-semibold text-slate-900">{clients.filter((client) => Date.now() - Date.parse(client.createdAt) < 30 * 24 * 60 * 60 * 1000).length}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
            <tr>
              <th className="px-5 py-3">Имя</th>
              <th className="px-5 py-3">Телефон</th>
              <th className="px-5 py-3">Дата рождения</th>
              <th className="px-5 py-3">Создан</th>
              <th className="px-5 py-3 text-right">Сделок</th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client) => {
              const clientDeals = deals.filter((deal) => deal.clientId === client.id);
              return (
                <tr key={client.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-slate-900">{client.name}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{client.phone || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(client.birthDate)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(client.createdAt)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">{clientDeals.length}</td>
                </tr>
              );
            })}
            {!clients.length && (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-slate-500">
                  Клиентов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
