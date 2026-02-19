import React, { useEffect, useMemo, useState } from 'react';
import { Client, Deal } from '../../types';
import { FilterBar } from '../FilterBar';
import { Pagination } from '../Pagination';
import { FilterParams } from '../../api';
import { DriveFilesModal } from '../DriveFilesModal';
import { TableHeadCell } from '../common/TableHeadCell';
import {
  TABLE_ACTIONS_CLASS_COL,
  TABLE_CELL_CLASS_LG,
  TABLE_ROW_CLASS,
  TABLE_THEAD_CLASS,
} from '../common/tableStyles';
import { formatDateRu } from '../../utils/formatting';
import { buildWhatsAppLink } from '../../utils/links';
import { DataTableShell } from '../common/table/DataTableShell';
import { BTN_SM_DANGER, BTN_SM_QUIET, BTN_SM_SECONDARY } from '../common/buttonStyles';
import { EmptyTableState } from '../common/table/EmptyTableState';

const PAGE_SIZE = 20;

interface ClientsViewProps {
  clients: Client[];
  deals: Deal[];
  onClientEdit?: (client: Client) => void;
  onClientDelete?: (client: Client) => void;
  onClientMerge?: (client: Client) => void;
  onClientFindSimilar?: (client: Client) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  deals,
  onClientEdit,
  onClientDelete,
  onClientMerge,
  onClientFindSimilar,
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
      <h1 className="sr-only">Клиенты</h1>
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

      <DataTableShell>
        <table
          className="deals-table min-w-full border-collapse text-left text-sm"
          aria-label="Список клиентов"
        >
          <thead className={TABLE_THEAD_CLASS}>
            <tr>
              <TableHeadCell className="min-w-[220px]">Имя</TableHeadCell>
              <TableHeadCell className="min-w-[180px]">Телефон</TableHeadCell>
              <TableHeadCell className="min-w-[170px]">Дата рождения</TableHeadCell>
              <TableHeadCell className="min-w-[170px]">Создан</TableHeadCell>
              <TableHeadCell align="right" className="min-w-[110px]">
                Сделок
              </TableHeadCell>
              <TableHeadCell align="right" className="min-w-[120px]">
                Файлы
              </TableHeadCell>
              <TableHeadCell align="right" className="min-w-[200px]">
                Действия
              </TableHeadCell>
            </tr>
          </thead>
          <tbody className="bg-white">
            {paginatedClients.map((client) => {
              const clientDeals = deals.filter((deal) => deal.clientId === client.id);
              const whatsAppLink = buildWhatsAppLink(client.phone);
              return (
                <tr key={client.id} className={TABLE_ROW_CLASS}>
                  <td className={TABLE_CELL_CLASS_LG}>
                    <p className="text-base font-semibold text-slate-900">{client.name}</p>
                  </td>
                  <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                    {client.phone && whatsAppLink ? (
                      <a
                        href={whatsAppLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-action"
                      >
                        {client.phone}
                      </a>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                    {formatDateRu(client.birthDate)}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_LG} text-slate-700`}>
                    {formatDateRu(client.createdAt)}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_LG} text-right font-semibold text-slate-900`}>
                    {clientDeals.length}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_LG} text-right`}>
                    <button
                      type="button"
                      onClick={() => setFilesModalClient(client)}
                      className={BTN_SM_SECONDARY}
                      aria-label={`Файлы клиента ${client.name}`}
                    >
                      Файлы
                    </button>
                  </td>
                  <td className={`${TABLE_CELL_CLASS_LG} text-right`}>
                    {onClientEdit || onClientDelete || onClientMerge || onClientFindSimilar ? (
                      <div className={TABLE_ACTIONS_CLASS_COL}>
                        {onClientEdit && (
                          <button
                            type="button"
                            onClick={() => onClientEdit(client)}
                            className={BTN_SM_QUIET}
                            aria-label={`Редактировать клиента ${client.name}`}
                          >
                            Редактировать
                          </button>
                        )}
                        {onClientDelete && (
                          <button
                            type="button"
                            onClick={() => onClientDelete(client)}
                            className={BTN_SM_DANGER}
                            aria-label={`Удалить клиента ${client.name}`}
                          >
                            Удалить
                          </button>
                        )}
                        {onClientMerge && (
                          <button
                            type="button"
                            onClick={() => onClientMerge(client)}
                            className={BTN_SM_QUIET}
                            aria-label={`Объединить клиента ${client.name}`}
                          >
                            Объединить
                          </button>
                        )}
                        {onClientFindSimilar && (
                          <button
                            type="button"
                            onClick={() => onClientFindSimilar(client)}
                            className={BTN_SM_SECONDARY}
                            aria-label={`Найти похожих клиентов для ${client.name}`}
                          >
                            Объединить похожих
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
              <EmptyTableState colSpan={7}>{emptyClientsMessage}</EmptyTableState>
            )}
          </tbody>
        </table>
      </DataTableShell>

      {filteredClients.length > PAGE_SIZE && (
        <Pagination
          currentPage={currentPage}
          totalItems={filteredClients.length}
          pageSize={PAGE_SIZE}
          onPageChange={handlePageChange}
        />
      )}

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
