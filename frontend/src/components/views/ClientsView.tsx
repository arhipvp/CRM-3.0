import React, { useEffect, useMemo, useState } from 'react';
import { Client, Deal } from '../../types';
import { FilterBar } from '../FilterBar';
import { Pagination } from '../Pagination';
import { FilterParams } from '../../api';
import { DriveFilesModal } from '../DriveFilesModal';

const formatDate = (value?: string | null) =>
  value ? new Date(value).toLocaleDateString('ru-RU') : 'вЂ”';

const PAGE_SIZE = 20;

interface ClientsViewProps {
  clients: Client[];
  deals: Deal[];
  onClientEdit?: (client: Client) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ clients, deals, onClientEdit }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<FilterParams>({});
  const [filesModalClient, setFilesModalClient] = useState<Client | null>(null);

  const handleFilterChange = (newFilters: FilterParams) => {
    setFilters(newFilters);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const filteredClients = useMemo(() => {
    const searchTerm = (filters.search ?? '').trim().toLowerCase();
    const ordering = filters.ordering ?? '';
    let filtered = [...clients];

    if (searchTerm) {
      filtered = filtered.filter((client) => {
        const name = client.name?.toLowerCase() ?? '';
        const phone = client.phone?.toLowerCase() ?? '';
        return name.includes(searchTerm) || phone.includes(searchTerm);
      });
    }

    if (ordering === 'name' || ordering === '-name') {
      filtered.sort((a, b) => {
        const nameA = (a.name ?? '').toLowerCase();
        const nameB = (b.name ?? '').toLowerCase();
        if (nameA === nameB) return 0;
        const comparison = nameA > nameB ? 1 : -1;
        return ordering === 'name' ? comparison : -comparison;
      });
    } else if (ordering === 'created_at' || ordering === '-created_at') {
      filtered.sort((a, b) => {
        const dateA = a.createdAt ? Date.parse(a.createdAt) : 0;
        const dateB = b.createdAt ? Date.parse(b.createdAt) : 0;
        if (dateA === dateB) return 0;
        const comparison = dateA > dateB ? 1 : -1;
        return ordering === 'created_at' ? comparison : -comparison;
      });
    }

    return filtered;
  }, [clients, filters]);

  const paginatedClients = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return filteredClients.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredClients, currentPage]);

  useEffect(() => {
    if (filteredClients.length > 0 && paginatedClients.length === 0) {
      const lastPage = Math.ceil(filteredClients.length / PAGE_SIZE);
      setCurrentPage(Math.max(1, lastPage));
    }
  }, [filteredClients, paginatedClients.length]);

  const totals = {
    active: deals.length,
    clients: clients.length,
  };

  const newClientsCount = useMemo(() => {
    const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return clients.filter((client) => {
      if (!client.createdAt) {
        return false;
      }
      const parsed = Date.parse(client.createdAt);
      return !Number.isNaN(parsed) && parsed >= threshold;
    }).length;
  }, [clients]);

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
          <p className="text-3xl font-semibold text-slate-900">{newClientsCount}</p>
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
            {paginatedClients.map((client) => {
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
                      Файлы
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
            {!paginatedClients.length && (
              <tr>
                <td colSpan={6} className="px-5 py-6 text-center text-slate-500">
                  Клиентов пока нет
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {filteredClients.length > PAGE_SIZE && (
          <Pagination
            currentPage={currentPage}
            totalItems={filteredClients.length}
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
