import React, { useEffect, useRef } from 'react';
import type { Deal, User } from '../../../types';
import { BTN_SM_QUIET } from '../../common/buttonStyles';

import { ColoredLabel } from '../../common/ColoredLabel';
import { TableHeadCell } from '../../common/TableHeadCell';
import { DataTableShell } from '../../common/table/DataTableShell';
import { EmptyTableState } from '../../common/table/EmptyTableState';
import { TABLE_CELL_CLASS_LG, TABLE_THEAD_CLASS } from '../../common/tableStyles';

import { formatDate, formatDeletedAt, getDeadlineTone, getUserDisplayName } from './helpers';

type DealsSortKey = 'deadline' | 'nextContact';
type DealsSortDirection = 'asc' | 'desc' | null;

interface DealsListProps {
  sortedDeals: Deal[];
  selectedDeal: Deal | null;
  dealRowFocusRequest?: { dealId: string; nonce: number } | null;
  dealSearch: string;
  onDealSearchChange: (value: string) => void;
  dealExecutorFilter: string;
  onDealExecutorFilterChange: (value: string) => void;
  dealShowDeleted: boolean;
  onDealShowDeletedChange: (value: boolean) => void;
  dealShowClosed: boolean;
  onDealShowClosedChange: (value: boolean) => void;
  dealOrdering?: string;
  onDealOrderingChange: (value: string | undefined) => void;
  users: User[];
  dealsHasMore: boolean;
  dealsTotalCount: number;
  isLoadingMoreDeals: boolean;
  onLoadMoreDeals: () => Promise<void>;
  onSelectDeal: (dealId: string) => void;
  onPinDeal: (dealId: string) => Promise<void>;
  onUnpinDeal: (dealId: string) => Promise<void>;
  currentUser: User | null;
  isDealSelectionBlocked?: boolean;
}

export const DealsList: React.FC<DealsListProps> = ({
  sortedDeals,
  selectedDeal,
  dealRowFocusRequest,
  dealSearch,
  onDealSearchChange,
  dealExecutorFilter,
  onDealExecutorFilterChange,
  dealShowDeleted,
  onDealShowDeletedChange,
  dealShowClosed,
  onDealShowClosedChange,
  dealOrdering,
  onDealOrderingChange,
  users,
  dealsHasMore,
  dealsTotalCount,
  isLoadingMoreDeals,
  onLoadMoreDeals,
  onSelectDeal,
  onPinDeal,
  onUnpinDeal,
  currentUser,
  isDealSelectionBlocked = false,
}) => {
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);
  const lastHandledFocusNonceRef = useRef<number | null>(null);

  const selectedDealId = selectedDeal?.id ?? null;

  useEffect(() => {
    if (!selectedDealId || !selectedRowRef.current || !selectedRowRef.current.isConnected) {
      return;
    }
    selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedDealId]);

  useEffect(() => {
    if (!dealRowFocusRequest) {
      return;
    }
    if (lastHandledFocusNonceRef.current === dealRowFocusRequest.nonce) {
      return;
    }
    if (dealRowFocusRequest.dealId !== selectedDealId) {
      return;
    }
    lastHandledFocusNonceRef.current = dealRowFocusRequest.nonce;
    if (!selectedRowRef.current || !selectedRowRef.current.isConnected) {
      return;
    }
    selectedRowRef.current.focus({ preventScroll: true });
  }, [dealRowFocusRequest, selectedDealId]);

  const getOrderingField = (key: DealsSortKey) =>
    key === 'deadline' ? 'expected_close' : 'next_contact_date';

  const getSortDirection = (key: DealsSortKey): DealsSortDirection => {
    const field = getOrderingField(key);
    if (dealOrdering === `-${field}`) {
      return 'desc';
    }
    if (dealOrdering === field) {
      return 'asc';
    }
    return null;
  };

  const toggleColumnSort = (key: DealsSortKey) => {
    const field = getOrderingField(key);
    const currentDirection = getSortDirection(key);
    if (!currentDirection) {
      onDealOrderingChange(field);
      return;
    }
    if (currentDirection === 'asc') {
      onDealOrderingChange(`-${field}`);
      return;
    }
    onDealOrderingChange(undefined);
  };

  const getSortIndicator = (key: DealsSortKey) => {
    const direction = getSortDirection(key);
    if (!direction) {
      return '↕';
    }
    return direction === 'asc' ? '↑' : '↓';
  };

  const getSortLabel = (key: DealsSortKey) => {
    const direction = getSortDirection(key);
    if (!direction) {
      return 'не сортируется';
    }
    return direction === 'asc' ? 'по возрастанию' : 'по убыванию';
  };

  const getColumnTitleClass = (key: DealsSortKey) => {
    const baseClass = 'text-[11px] font-semibold uppercase tracking-wide';
    if (getSortDirection(key)) {
      return `${baseClass} text-rose-600 underline decoration-rose-500 decoration-2 underline-offset-2`;
    }
    return `${baseClass} text-slate-900`;
  };

  const getAriaSort = (key: DealsSortKey): 'ascending' | 'descending' | 'none' => {
    const direction = getSortDirection(key);
    if (!direction) {
      return 'none';
    }
    return direction === 'asc' ? 'ascending' : 'descending';
  };

  const handleClientDealsCountClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    clientName: string | null | undefined,
  ) => {
    event.stopPropagation();
    if (!clientName) {
      return;
    }
    onDealSearchChange(clientName);
  };

  return (
    <>
      <div className="px-4 py-4 bg-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">Сделки</span>
            <span className="text-sm text-slate-500 whitespace-nowrap">
              Сделок всего {dealsTotalCount}, показано {sortedDeals.length}
            </span>
          </div>
          <div className="w-full max-w-sm">
            <label htmlFor="dealSearch" className="sr-only">
              Поиск по сделкам
            </label>
            <div className="relative">
              <input
                id="dealSearch"
                type="text"
                value={dealSearch}
                onChange={(event) => onDealSearchChange(event.target.value)}
                placeholder="Поиск по сделкам"
                className="field field-input pr-10"
              />
              {dealSearch && (
                <button
                  type="button"
                  onClick={() => onDealSearchChange('')}
                  aria-label="Очистить поиск сделок"
                  className="search-clear-btn"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 border-b border-slate-200 bg-white">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <input
              id="dealShowClosed"
              type="checkbox"
              checked={dealShowClosed}
              onChange={(event) => onDealShowClosedChange(event.target.checked)}
              className="check"
            />
            <label htmlFor="dealShowClosed" className="text-xs font-semibold text-slate-500">
              Показать закрытые сделки
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="dealShowDeleted"
              type="checkbox"
              checked={dealShowDeleted}
              onChange={(event) => onDealShowDeletedChange(event.target.checked)}
              className="check"
            />
            <label htmlFor="dealShowDeleted" className="text-xs font-semibold text-slate-500">
              Показать удалённые сделки
            </label>
          </div>

          <div className="flex items-center gap-2 min-w-[220px]">
            <label
              htmlFor="dealExecutorFilter"
              className="text-xs font-semibold text-slate-500 whitespace-nowrap"
            >
              Исполнитель
            </label>
            <select
              id="dealExecutorFilter"
              value={dealExecutorFilter}
              onChange={(event) => onDealExecutorFilterChange(event.target.value)}
              aria-label="Фильтр по исполнителю"
              className="field field-select"
            >
              <option value="">Все</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {getUserDisplayName(user)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {isDealSelectionBlocked && (
          <p className="mt-3 text-xs font-semibold text-rose-700">
            Подтвердите продолжение учета времени, чтобы переключиться на другую сделку.
          </p>
        )}
      </div>

      <DataTableShell>
        <div className="max-h-[360px] overflow-y-auto bg-white">
          <table className="deals-table min-w-full border-collapse text-left text-sm">
            <thead className={`sticky top-0 ${TABLE_THEAD_CLASS}`}>
              <tr>
                <TableHeadCell className="min-w-[260px]">Сделка</TableHeadCell>
                <TableHeadCell className="min-w-[200px]">Клиент</TableHeadCell>
                <TableHeadCell
                  align="right"
                  className="min-w-[200px]"
                  aria-sort={getAriaSort('nextContact')}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort('nextContact')}
                    aria-label={`Сортировать по следующему контакту, текущий порядок ${getSortLabel(
                      'nextContact',
                    )}`}
                    className="flex w-full items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <span className={getColumnTitleClass('nextContact')}>След. контакт</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      {getSortIndicator('nextContact')}
                    </span>
                  </button>
                </TableHeadCell>
                <TableHeadCell
                  align="center"
                  className="min-w-[180px]"
                  aria-sort={getAriaSort('deadline')}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort('deadline')}
                    aria-label={`Сортировать по крайнему сроку, текущий порядок ${getSortLabel(
                      'deadline',
                    )}`}
                    className="flex w-full items-center justify-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                  >
                    <span className={getColumnTitleClass('deadline')}>Крайний срок</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                      {getSortIndicator('deadline')}
                    </span>
                  </button>
                </TableHeadCell>
                <TableHeadCell className="min-w-[190px]">Исполнитель</TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white">
              {sortedDeals.length ? (
                sortedDeals.map((deal) => {
                  const deadlineTone = getDeadlineTone(deal.expectedClose);
                  const isDeleted = Boolean(deal.deletedAt);
                  const deletedTextClass = isDeleted ? 'line-through decoration-rose-500/80' : '';
                  const isSelected = selectedDeal?.id === deal.id;
                  const isPinned = Boolean(deal.isPinned);
                  const activeDealsCount = deal.clientActiveDealsCount;
                  const canPin =
                    Boolean(currentUser) &&
                    (currentUser?.roles?.includes('Admin') || deal.seller === currentUser?.id);
                  const rowClassName = [
                    'transition-colors',
                    'cursor-pointer',
                    'even:bg-slate-50/40',
                    'border-l-4 border-transparent',
                    'border-sky-500',
                    'hover:bg-slate-50/80 hover:border-sky-500',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                    isDealSelectionBlocked ? 'cursor-not-allowed opacity-80' : '',
                    isSelected
                      ? 'bg-sky-100/80 border-sky-600 shadow-sm ring-2 ring-sky-400/60 ring-inset'
                      : '',
                    isPinned ? 'border-rose-500 ring-2 ring-rose-500/40 ring-inset' : '',
                    isDeleted ? 'opacity-60' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => {
                        if (isDealSelectionBlocked) {
                          return;
                        }
                        onSelectDeal(deal.id);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          if (isDealSelectionBlocked) {
                            return;
                          }
                          onSelectDeal(deal.id);
                        }
                      }}
                      tabIndex={0}
                      aria-selected={isSelected}
                      className={rowClassName}
                      ref={(element) => {
                        if (deal.id === selectedDeal?.id) {
                          selectedRowRef.current = element;
                        }
                      }}
                    >
                      <td className={`${TABLE_CELL_CLASS_LG} ${deletedTextClass}`}>
                        <div className="flex items-start gap-2">
                          {canPin && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (isDealSelectionBlocked) {
                                  return;
                                }
                                if (isPinned) {
                                  void onUnpinDeal(deal.id);
                                } else {
                                  void onPinDeal(deal.id);
                                }
                              }}
                              aria-label={isPinned ? 'Открепить сделку' : 'Закрепить сделку'}
                              title={isPinned ? 'Открепить' : 'Закрепить'}
                              disabled={isDealSelectionBlocked}
                              className={`icon-btn h-7 w-7 ${
                                isPinned
                                  ? 'border-rose-200 text-rose-600 hover:bg-rose-50'
                                  : 'border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600'
                              }`}
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M14.8 3.3a1 1 0 0 1 1.4 0l2.5 2.5a1 1 0 0 1 0 1.4l-2 2 2.2 2.2c.4.4.4 1 0 1.4l-1.4 1.4a1 1 0 0 1-1.4 0l-2.2-2.2-5.8 5.8a1 1 0 0 1-.7.3H6v3a1 1 0 1 1-2 0v-3a1 1 0 0 1 1-1h2.3a1 1 0 0 1 .7.3l5.8-5.8-2.2-2.2a1 1 0 0 1 0-1.4l1.4-1.4a1 1 0 0 1 1.4 0l2.2 2.2 2-2a1 1 0 0 1 0-1.4l-2.5-2.5a1 1 0 0 1 0-1.4z" />
                              </svg>
                            </button>
                          )}
                          <div className="space-y-1">
                            <p
                              className={`text-base font-semibold text-slate-900 ${deletedTextClass}`}
                            >
                              {deal.title}
                            </p>
                            {deal.deletedAt && (
                              <p className="text-xs font-semibold text-rose-600">
                                Удалена: {formatDeletedAt(deal.deletedAt)}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td
                        className={`${TABLE_CELL_CLASS_LG} text-sm text-slate-900 ${deletedTextClass}`}
                      >
                        {deal.clientName ? (
                          <span className={deletedTextClass}>
                            {deal.clientName}
                            {activeDealsCount !== undefined && (
                              <>
                                {' '}
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    handleClientDealsCountClick(event, deal.clientName)
                                  }
                                  className="font-semibold text-sky-700 underline decoration-dotted underline-offset-2 transition hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                                  aria-label={`Показать все сделки клиента ${deal.clientName}`}
                                  title={`Показать сделки клиента ${deal.clientName}`}
                                >
                                  ({activeDealsCount})
                                </button>
                              </>
                            )}
                          </span>
                        ) : (
                          <span className={deletedTextClass}>—</span>
                        )}
                      </td>
                      <td
                        className={`${TABLE_CELL_CLASS_LG} text-sm text-right ${deletedTextClass}`}
                      >
                        {deal.nextContactDate ? (
                          <span
                            className={`text-sm font-semibold text-slate-900 ${deletedTextClass}`}
                          >
                            {formatDate(deal.nextContactDate)}
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-semibold text-rose-600 ${deletedTextClass}`}
                          >
                            Не назначено
                          </span>
                        )}
                      </td>
                      <td
                        className={`${TABLE_CELL_CLASS_LG} text-sm font-semibold text-center ${deletedTextClass}`}
                      >
                        {deal.expectedClose ? (
                          <span className={`${deadlineTone}`}>
                            {formatDate(deal.expectedClose)}
                          </span>
                        ) : (
                          <span
                            className={`text-xs font-semibold text-rose-600 ${deletedTextClass}`}
                          >
                            Нет срока
                          </span>
                        )}
                      </td>
                      <td
                        className={`${TABLE_CELL_CLASS_LG} text-sm text-slate-900 ${deletedTextClass}`}
                      >
                        <ColoredLabel
                          value={deal.executorName}
                          fallback="—"
                          className={`text-sm text-slate-900 font-semibold ${deletedTextClass}`}
                          showDot={false}
                        />
                      </td>
                    </tr>
                  );
                })
              ) : (
                <EmptyTableState colSpan={5}>Сделки не найдены.</EmptyTableState>
              )}
            </tbody>
          </table>
        </div>
      </DataTableShell>

      {dealsHasMore && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center">
          <button
            type="button"
            onClick={onLoadMoreDeals}
            disabled={isLoadingMoreDeals}
            className={BTN_SM_QUIET}
          >
            {isLoadingMoreDeals ? 'Загрузка...' : 'Показать ещё'}
          </button>
        </div>
      )}
    </>
  );
};
