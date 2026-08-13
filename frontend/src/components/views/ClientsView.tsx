import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Client, ClientDuplicateHint, Deal } from '../../types';
import { FilterBar } from '../FilterBar';
import { Pagination } from '../Pagination';
import { fetchClientsWithPagination, fetchClientStats, FilterParams } from '../../api';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
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
import { BTN_SM_QUIET, BTN_SM_SECONDARY } from '../common/buttonStyles';
import { EmptyTableState } from '../common/table/EmptyTableState';
import { ClientNameIndicators } from '../clients/ClientNameIndicators';
import { PageHeader, PageShell, Panel } from '../common/layoutPrimitives';

const PAGE_SIZE = 20;

interface ClientsViewProps {
  clients: Client[];
  deals: Deal[];
  onClientEdit?: (client: Client) => void;
  onClientDelete?: (client: Client) => void;
  onClientMerge?: (client: Client) => void;
  onClientFindSimilar?: (client: Client) => void;
  onClientNormalizeName?: (client: Client, normalizedName: string) => Promise<void>;
  clientDuplicateHints?: Record<string, ClientDuplicateHint>;
  dealsTotalCount?: number;
}

export const ClientsView: React.FC<ClientsViewProps> = ({
  clients,
  deals,
  onClientEdit,
  onClientDelete,
  onClientMerge,
  onClientFindSimilar,
  onClientNormalizeName,
  clientDuplicateHints = {},
  dealsTotalCount,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const initialFilters = useMemo<FilterParams>(
    () => ({
      search: searchParams.get('search') || undefined,
      ordering: searchParams.get('ordering') || '-created_at',
    }),
    [searchParams],
  );
  const [filters, setFilters] = useState<FilterParams>(initialFilters);
  const debouncedSearch = useDebouncedValue(String(filters.search ?? '').trim(), 300);
  const [visibleClients, setVisibleClients] = useState(clients.slice(0, PAGE_SIZE));
  const [totalClients, setTotalClients] = useState(clients.length);
  const [newClientsCount, setNewClientsCount] = useState(0);
  const [isClientsLoading, setIsClientsLoading] = useState(false);
  const [clientsError, setClientsError] = useState('');
  const [filesModalClient, setFilesModalClient] = useState<Client | null>(null);
  const [actionsClientId, setActionsClientId] = useState<string | null>(null);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const handleFilterChange = (newFilters: FilterParams) => {
    setFilters(newFilters);
    const nextParams = new URLSearchParams();
    if (newFilters.search) nextParams.set('search', String(newFilters.search));
    if (newFilters.ordering && newFilters.ordering !== '-created_at') {
      nextParams.set('ordering', String(newFilters.ordering));
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handlePageChange = (page: number) => {
    const nextParams = new URLSearchParams(searchParams);
    if (page <= 1) nextParams.delete('page');
    else nextParams.set('page', String(page));
    setSearchParams(nextParams);
  };

  const filteredClients = useMemo(() => {
    const searchTerm = (filters.search ?? '').trim().toLowerCase();
    const ordering = filters.ordering ?? '';
    let filtered = [...visibleClients];

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
  }, [filters, visibleClients]);

  const paginatedClients = useMemo(() => {
    return filteredClients;
  }, [filteredClients]);

  const dealCountByClient = useMemo(() => {
    const counts = new Map<string, number>();
    deals.forEach((deal) => {
      if (deal.clientId) {
        counts.set(deal.clientId, (counts.get(deal.clientId) ?? 0) + 1);
      }
    });
    return counts;
  }, [deals]);

  useEffect(() => {
    const controller = new AbortController();
    setIsClientsLoading(true);
    setClientsError('');
    void Promise.all([
      fetchClientsWithPagination(
        {
          page: currentPage,
          page_size: PAGE_SIZE,
          search: debouncedSearch || undefined,
          ordering: filters.ordering || '-created_at',
        },
        { signal: controller.signal },
      ),
      fetchClientStats({ search: debouncedSearch || undefined }, { signal: controller.signal }),
    ])
      .then(([payload, stats]) => {
        if (controller.signal.aborted) return;
        setVisibleClients(payload.results);
        setTotalClients(payload.count);
        setNewClientsCount(stats.createdLast30Days);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setClientsError('Не удалось обновить список клиентов.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsClientsLoading(false);
      });
    return () => controller.abort();
  }, [clients, currentPage, debouncedSearch, filters.ordering]);

  const totals = {
    active: dealsTotalCount ?? deals.length,
    clients: totalClients,
  };
  const hasPartialDealsMetric = dealsTotalCount === undefined && deals.length > 0;

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

  return (
    <PageShell>
      <PageHeader title="Клиенты" description="Клиентская база, контакты и связанные сделки" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Panel padding="sm" className="border-blue-100 bg-blue-50/80">
          <p className="text-xs text-slate-500">Клиентов</p>
          <p className="text-2xl font-semibold text-slate-900">{totals.clients}</p>
        </Panel>
        <Panel padding="sm">
          <p className="text-xs text-slate-500">
            {hasPartialDealsMetric ? 'Загружено сделок' : 'Активных сделок'}
          </p>
          <p className="text-2xl font-semibold text-slate-900">{totals.active}</p>
        </Panel>
        <Panel padding="sm">
          <p className="text-xs text-slate-500">Новых за 30 дней</p>
          <p className="text-2xl font-semibold text-slate-900">{newClientsCount}</p>
        </Panel>
      </div>

      <FilterBar
        onFilterChange={handleFilterChange}
        initialFilters={initialFilters}
        searchPlaceholder="Поиск по имени или телефону..."
        sortOptions={[
          { value: '-created_at', label: 'Новые' },
          { value: 'created_at', label: 'Старые' },
          { value: 'name', label: 'Имя (А-Я)' },
          { value: '-name', label: 'Имя (Я-А)' },
        ]}
      />

      {clientsError ? <p className="text-sm text-rose-700">{clientsError}</p> : null}

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
              <TableHeadCell align="right" className="min-w-[150px]">
                Действия
              </TableHeadCell>
            </tr>
          </thead>
          <tbody className="bg-white">
            {paginatedClients.map((client) => {
              const clientDealsCount = client.dealCount ?? dealCountByClient.get(client.id) ?? 0;
              const whatsAppLink = buildWhatsAppLink(client.phone);
              return (
                <tr key={client.id} className={`${TABLE_ROW_CLASS} hover:bg-blue-50/60`}>
                  <td className={TABLE_CELL_CLASS_LG}>
                    <div className="flex items-center gap-2">
                      <ClientNameIndicators
                        client={client}
                        hint={clientDuplicateHints[client.id]}
                        onFindSimilar={onClientFindSimilar}
                        onNormalizeName={onClientNormalizeName}
                      />
                      <p className="text-base font-semibold text-slate-900">{client.name}</p>
                    </div>
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
                    {clientDealsCount}
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
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() =>
                              setActionsClientId((current) =>
                                current === client.id ? null : client.id,
                              )
                            }
                            className={BTN_SM_SECONDARY}
                            aria-expanded={actionsClientId === client.id}
                            aria-label={`Дополнительные действия клиента ${client.name}`}
                          >
                            Ещё
                          </button>
                          {actionsClientId === client.id && (
                            <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-slate-200 bg-white p-1 text-left shadow-lg">
                              {onClientFindSimilar && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionsClientId(null);
                                    onClientFindSimilar(client);
                                  }}
                                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Объединить похожих
                                </button>
                              )}
                              {onClientMerge && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionsClientId(null);
                                    onClientMerge(client);
                                  }}
                                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Объединить вручную
                                </button>
                              )}
                              {onClientDelete && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionsClientId(null);
                                    onClientDelete(client);
                                  }}
                                  className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                >
                                  Удалить
                                </button>
                              )}
                            </div>
                          )}
                        </div>
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

      {isClientsLoading ? <p className="text-sm text-slate-500">Обновляем список…</p> : null}
      {totalClients > PAGE_SIZE && (
        <Pagination
          currentPage={currentPage}
          totalItems={totalClients}
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
    </PageShell>
  );
};
