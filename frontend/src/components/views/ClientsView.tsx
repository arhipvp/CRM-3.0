import React, { useEffect, useMemo, useState } from 'react';
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
  onClientEdit?: (client: Client) => void;
  onClientDelete?: (client: Client) => void;
  onClientMerge?: (client: Client) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  deals,
  onClientEdit,
  onClientDelete,
  onClientMerge,
}) => {
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

  const emptyClientsMessage = useMemo(() => {
    const searchTerm = (filters.search ?? '').trim();
    if (!clients.length) {
      return 'Клиентов пока нет.';
    }
    if (searchTerm) {
      return 'Поиск не дал результатов.';
    }
    return 'Клиентов не найдено.';
  }, [clients.length, filters.search]);

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
        <div className="app-panel p-5 shadow-none">
          <p className="text-sm text-slate-500">Клиентов</p>
          <p className="text-3xl font-semibold text-slate-900">{totals.clients}</p>
        </div>
        <div className="app-panel p-5 shadow-none">
          <p className="text-sm text-slate-500">Активных сделок</p>
          <p className="text-3xl font-semibold text-slate-900">{totals.active}</p>
        </div>
        <div className="app-panel p-5 shadow-none">
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

      <div className="app-panel shadow-none overflow-hidden">
        <div className="overflow-x-auto bg-white">
        <table className="deals-table min-w-full border-collapse text-left text-sm">
          <thead className="bg-white/90 backdrop-blur border-b border-slate-200">
            <tr>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 min-w-[220px]">
                Имя
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 min-w-[180px]">
                Телефон
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 min-w-[170px]">
                Дата рождения
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 min-w-[170px]">
                Создан
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 text-right min-w-[110px]">
                Сделок
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 text-right min-w-[120px]">
                Файлы
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 text-right min-w-[200px]">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {paginatedClients.map((client) => {
              const clientDeals = deals.filter((deal) => deal.clientId === client.id);
              return (
                <tr
                  key={client.id}
                  className="transition-colors even:bg-slate-50/40 border-l-4 border-transparent hover:bg-slate-50/80 hover:border-sky-500"
                >
                  <td className="border border-slate-200 px-6 py-3">
                    <p className="text-base font-semibold text-slate-900">{client.name}</p>
                  </td>
                  <td className="border border-slate-200 px-6 py-3 text-slate-700">
                    {client.phone ? (
                      <a
                        href={`https://wa.me/${client.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-700 font-semibold hover:text-sky-900 hover:underline"
                      >
                        {client.phone}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="border border-slate-200 px-6 py-3 text-slate-700">
                    {formatDate(client.birthDate)}
                  </td>
                  <td className="border border-slate-200 px-6 py-3 text-slate-700">
                    {formatDate(client.createdAt)}
                  </td>
                  <td className="border border-slate-200 px-6 py-3 text-right font-semibold text-slate-900">
                    {clientDeals.length}
                  </td>
                  <td className="border border-slate-200 px-6 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => setFilesModalClient(client)}
                      className="btn btn-secondary btn-sm rounded-xl"
                    >
                      Файлы
                    </button>
                  </td>
                  <td className="border border-slate-200 px-6 py-3 text-right">
                    {onClientEdit || onClientDelete || onClientMerge ? (
                      <div className="flex flex-col items-end gap-1">
                        {onClientEdit && (
                          <button
                            type="button"
                            onClick={() => onClientEdit(client)}
                            className="text-sm font-semibold text-sky-700 hover:text-sky-900"
                          >
                            Редактировать
                          </button>
                        )}
                        {onClientDelete && (
                          <button
                            type="button"
                            onClick={() => onClientDelete(client)}
                            className="text-sm font-semibold text-rose-700 hover:text-rose-900"
                          >
                            Удалить
                          </button>
                        )}
                        {onClientMerge && (
                          <button
                            type="button"
                            onClick={() => onClientMerge(client)}
                            className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                          >
                            Объединить
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs uppercase tracking-wide text-slate-400">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!paginatedClients.length && (
              <tr>
                <td
                  colSpan={7}
                  className="border border-slate-200 px-6 py-10 text-center text-slate-600"
                >
                  <div className="app-panel-muted inline-flex px-4 py-3 text-sm text-slate-600">
                    {emptyClientsMessage}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
        </div>

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
