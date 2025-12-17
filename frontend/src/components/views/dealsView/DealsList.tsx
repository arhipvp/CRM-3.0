import React, { useEffect, useRef } from 'react';
import type { Deal, User } from '../../../types';

import { ColoredLabel } from '../../common/ColoredLabel';
import { TableHeadCell } from '../../common/TableHeadCell';
import { TABLE_CELL_CLASS_LG, TABLE_THEAD_CLASS } from '../../common/tableStyles';
import { PanelMessage } from '../../PanelMessage';

import {
  formatDate,
  formatDeletedAt,
  getDeadlineTone,
  getUserDisplayName,
} from './helpers';

type DealsSortKey = 'deadline' | 'nextContact';
type DealsSortDirection = 'asc' | 'desc' | null;

interface DealsListProps {
  sortedDeals: Deal[];
  selectedDeal: Deal | null;
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
  isLoadingMoreDeals: boolean;
  onLoadMoreDeals: () => Promise<void>;
  onSelectDeal: (dealId: string) => void;
}

export const DealsList: React.FC<DealsListProps> = ({
  sortedDeals,
  selectedDeal,
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
  isLoadingMoreDeals,
  onLoadMoreDeals,
  onSelectDeal,
}) => {
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);

  const selectedDealId = selectedDeal?.id ?? null;

  useEffect(() => {
    if (
      !selectedDealId ||
      !selectedRowRef.current ||
      !selectedRowRef.current.isConnected
    ) {
      return;
    }
    selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedDealId]);

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

  return (
    <>
      <div className="px-4 py-4 bg-white">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">
              Сделки
            </span>
            <span className="text-sm text-slate-500 whitespace-nowrap">
              Всего {sortedDeals.length}
            </span>
          </div>
          <div className="w-full max-w-sm">
            <label htmlFor="dealSearch" className="sr-only">
              Поиск по сделкам
            </label>
            <input
              id="dealSearch"
              type="search"
              value={dealSearch}
              onChange={(event) => onDealSearchChange(event.target.value)}
              placeholder="Поиск по сделкам"
              className="field field-input"
            />
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
      </div>

      <div className="max-h-[360px] overflow-y-auto bg-white">
          <table className="deals-table min-w-full border-collapse text-left text-sm">
          <thead className={`sticky top-0 ${TABLE_THEAD_CLASS}`}>
            <tr>
              <TableHeadCell className="min-w-[260px]">Сделка</TableHeadCell>
              <TableHeadCell className="min-w-[200px]">Клиент</TableHeadCell>
              <TableHeadCell
                align="center"
                  className="min-w-[180px]"
                  aria-sort={getAriaSort('deadline')}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort('deadline')}
                    aria-label={`Сортировать по крайнему сроку, текущий порядок ${getSortLabel(
                    'deadline'
                  )}`}
                  className="flex w-full items-center justify-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <span className={getColumnTitleClass('deadline')}>Крайний срок</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                    {getSortIndicator('deadline')}
                  </span>
                  </button>
                </TableHeadCell>
                <TableHeadCell
                  align="right"
                  className="min-w-[200px]"
                  aria-sort={getAriaSort('nextContact')}
                >
                  <button
                    type="button"
                    onClick={() => toggleColumnSort('nextContact')}
                    aria-label={`Сортировать по следующему контакту, текущий порядок ${getSortLabel(
                    'nextContact'
                  )}`}
                  className="flex w-full items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <span className={getColumnTitleClass('nextContact')}>След. контакт</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                    {getSortIndicator('nextContact')}
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
                const rowClassName = [
                  'transition-colors',
                  'cursor-pointer',
                  'even:bg-slate-50/40',
                  'border-l-4 border-transparent',
                  'hover:bg-slate-50/80 hover:border-sky-500',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white',
                  isSelected ? 'bg-sky-50 border-sky-500 shadow-sm' : '',
                  isDeleted ? 'opacity-60' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <tr
                    key={deal.id}
                    onClick={() => onSelectDeal(deal.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
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
                      <p className={`text-base font-semibold text-slate-900 ${deletedTextClass}`}>
                        {deal.title}
                      </p>
                      {deal.deletedAt && (
                        <p className="mt-1 text-xs font-semibold text-rose-600">
                          Удалена: {formatDeletedAt(deal.deletedAt)}
                        </p>
                      )}
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS_LG} text-sm text-slate-900 ${deletedTextClass}`}
                    >
                      <span className={deletedTextClass}>{deal.clientName || '—'}</span>
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS_LG} text-sm font-semibold text-center ${deletedTextClass}`}
                    >
                      {deal.expectedClose ? (
                        <span className={`${deadlineTone}`}>{formatDate(deal.expectedClose)}</span>
                      ) : (
                        <span className={`text-xs font-semibold text-rose-600 ${deletedTextClass}`}>
                          Нет срока
                        </span>
                      )}
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS_LG} text-sm text-right ${deletedTextClass}`}
                    >
                      {deal.nextContactDate ? (
                        <span className={`text-sm font-semibold text-slate-900 ${deletedTextClass}`}>
                          {formatDate(deal.nextContactDate)}
                        </span>
                      ) : (
                        <span className={`text-xs font-semibold text-rose-600 ${deletedTextClass}`}>
                          Не назначено
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
              <tr>
                <td colSpan={5} className="border border-slate-200 px-6 py-4 text-center text-sm text-slate-500">
                  <PanelMessage>Сделки не найдены.</PanelMessage>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dealsHasMore && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center">
          <button
            type="button"
            onClick={onLoadMoreDeals}
            disabled={isLoadingMoreDeals}
            className="btn btn-quiet btn-sm rounded-xl"
          >
            {isLoadingMoreDeals ? 'Загрузка...' : 'Показать ещё'}
          </button>
        </div>
      )}
    </>
  );
};
