import React, { useState } from 'react';
import { Client, Deal } from '../../types';
import { FilterBar } from '../FilterBar';
import { Pagination } from '../Pagination';
import { FilterParams } from '../../api';
import { DriveFilesModal } from '../DriveFilesModal';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('ru-RU') : '—';

const PAGE_SIZE = 20;

interface ClientsViewProps {
  clients: Client[];
  deals: Deal[];
  totalClients?: number;
  onFilterChange?: (filters: FilterParams) => void;
  onClientEdit?: (client: Client) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  deals,
  totalClients = 0,
  onFilterChange,
  onClientEdit,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterParams>({});
  const [filesModalClient, setFilesModalClient] = useState<Client | null>(null);

  const handleFilterChange = (newFilters: FilterParams) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
    onFilterChange?.(newFilters);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    onFilterChange?.({ ...filters, page, page_size: PAGE_SIZE });
  };

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
          <p className="text-3xl font-semibold text-slate-900">
            {
              clients.filter(
                (client) => Date.now() - Date.parse(client.createdAt) < 30 * 24 * 60 * 60 * 1000
              ).length
            }
          </p>
        </div>
      </div>

      <FilterBar
        onFilterChange={handleFilterChange}
        searchPlaceholder="Поиск по имени или телефону..."
        sortOptions={[
          { value: '-created_at', label: 'Новые' },
          { value: 'created_at', label: 'Старые' },
          { value: 'name', label: 'Имя (А-Я)' },
          { value: '-name', label: 'Имя (Я-А)' },
        ]}
      />

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500 uppercase tracking-wide text-xs">
            <tr>
              <th className="px-5 py-3">Имя</th>
              <th className="px-5 py-3">Телефон</th>
              <th className="px-5 py-3">Дата рождения</th>
              <th className="px-5 py-3">Создан</th>
              <th className="px-5 py-3 text-right">Сделок</th>
              <th className="px-5 py-3 text-right">Файлы</th>
              <th className="px-5 py-3 text-right">Действия</th>
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
                  <td className="px-5 py-4 text-slate-600">
                    {client.phone ? (
                      <a
                        href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        {client.phone}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(client.birthDate)}</td>
                  <td className="px-5 py-4 text-slate-600">{formatDate(client.createdAt)}</td>
                  <td className="px-5 py-4 text-right font-semibold text-slate-900">
                    {clientDeals.length}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setFilesModalClient(client)}
                      className="text-sm font-medium text-slate-500 hover:text-sky-600 transition-colors"
                    >
                      📁 Файлы
                    </button>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {onClientEdit ? (
                      <button
                        type="button"
                        onClick={() => onClientEdit(client)}
                        className="text-sm font-semibold text-sky-600 hover:text-sky-800"
                      >
                        Редактировать
                      </button>
                    ) : (
                      <span className="text-xs uppercase tracking-wide text-slate-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!clients.length && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                  Клиентов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {clients.length > 0 && (
          <Pagination
            currentPage={currentPage}
            totalItems={totalClients || clients.length}
            pageSize={PAGE_SIZE}
            onPageChange={handlePageChange}
          />
        )}
      </div>

      {filesModalClient && (
        <DriveFilesModal
          isOpen={!!filesModalClient}
          onClose={() => setFilesModalClient(null)}
          entityId={filesModalClient.id}
          entityType="client"
          title={`Файлы клиента: ${filesModalClient.name}`}
        />
      )}
    </div>
  );
};
