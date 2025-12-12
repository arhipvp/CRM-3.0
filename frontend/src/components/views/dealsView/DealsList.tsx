import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Deal, User } from '../../../types';

import { ColoredLabel } from '../../common/ColoredLabel';

import {
  formatDate,
  formatDeletedAt,
  getDeadlineTone,
  getUserDisplayName,
} from './helpers';

type DealsSortKey = 'deadline' | 'nextContact';

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
  users,
  dealsHasMore,
  isLoadingMoreDeals,
  onLoadMoreDeals,
  onSelectDeal,
}) => {
  const [sortState, setSortState] = useState<{
    key: DealsSortKey | null;
    direction: 'asc' | 'desc' | null;
  }>({
    key: null,
    direction: null,
  });

  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);

  const selectedDealId = selectedDeal?.id ?? null;

  useEffect(() => {
    if (!selectedDealId || !selectedRowRef.current || !selectedRowRef.current.isConnected) {
      return;
    }
    selectedRowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedDealId]);

  const toggleColumnSort = (key: DealsSortKey) => {
    setSortState((current) => {
      if (current.key !== key) {
        return { key, direction: 'asc' };
      }
      if (current.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return { key: null, direction: null };
    });
  };

  const getSortIndicator = (key: DealsSortKey) => {
    if (sortState.key !== key || !sortState.direction) {
      return '–';
    }
    return sortState.direction === 'asc' ? '↑' : '↓';
  };

  const getSortLabel = (key: DealsSortKey) => {
    if (sortState.key !== key || !sortState.direction) {
      return 'по умолчанию';
    }
    return sortState.direction === 'asc' ? 'по возрастанию' : 'по убыванию';
  };

  const getColumnTitleClass = (key: DealsSortKey) => {
    const baseClass = 'text-[11px] font-semibold uppercase tracking-wide';
    if (sortState.key === key && sortState.direction) {
      return `${baseClass} text-rose-600 underline decoration-rose-500 decoration-2 underline-offset-2`;
    }
    return `${baseClass} text-slate-900`;
  };

  const displayedDeals = useMemo<Deal[]>(() => {
    if (!sortState.key || !sortState.direction) {
      return sortedDeals;
    }
    const getSortValue = (deal: Deal) => {
      if (sortState.key === 'deadline') {
        return deal.expectedClose ? new Date(deal.expectedClose).getTime() : Infinity;
      }
      return deal.nextContactDate ? new Date(deal.nextContactDate).getTime() : Infinity;
    };
    const sorted = [...sortedDeals].sort((a, b) => {
      const difference = getSortValue(a) - getSortValue(b);
      return sortState.direction === 'asc' ? difference : -difference;
    });
    return sorted;
  }, [sortedDeals, sortState]);

  return (
    <>
      <div className="px-4 py-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-[10px] uppercase tracking-[0.4em] text-slate-400 whitespace-nowrap">
              Выбор
            </span>
            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">Сделки</span>
            <span className="text-sm text-slate-500 whitespace-nowrap">Всего {displayedDeals.length}</span>
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
              className="h-10 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:border-sky-500 focus:ring focus:ring-sky-100 focus:ring-offset-0"
            />
          </div>
        </div>
      </div>
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <input
              id="dealShowClosed"
              type="checkbox"
              checked={dealShowClosed}
              onChange={(event) => onDealShowClosedChange(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
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
              className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
            />
            <label htmlFor="dealShowDeleted" className="text-xs font-semibold text-slate-500">
              Показать удалённые сделки
            </label>
          </div>
        </div>
      </div>
      <div className="max-h-[360px] overflow-y-auto bg-white">
        <table className="deals-table min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-white/90 backdrop-blur border-b border-slate-200">
            <tr>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 min-w-[260px]">
                Сделка
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 min-w-[200px]">
                Клиент
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-center text-slate-900 min-w-[180px]">
                <button
                  type="button"
                  onClick={() => toggleColumnSort('deadline')}
                  aria-label={`Сортировать по крайнему сроку, текущий порядок ${getSortLabel(
                    'deadline'
                  )}`}
                  className="flex w-full items-center justify-center gap-2"
                >
                  <span className={getColumnTitleClass('deadline')}>Крайний срок</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                    {getSortIndicator('deadline')}
                  </span>
                </button>
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-right text-slate-900 min-w-[200px]">
                <button
                  type="button"
                  onClick={() => toggleColumnSort('nextContact')}
                  aria-label={`Сортировать по следующему контакту, текущий порядок ${getSortLabel(
                    'nextContact'
                  )}`}
                  className="flex w-full items-center justify-end gap-2"
                >
                  <span className={getColumnTitleClass('nextContact')}>След. контакт</span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                    {getSortIndicator('nextContact')}
                  </span>
                </button>
              </th>
              <th className="border border-slate-200 px-6 py-3 text-[11px] uppercase tracking-[0.3em] text-slate-900 min-w-[190px]">
                Исполнитель
              </th>
            </tr>
            <tr className="border-t border-slate-200 bg-slate-50/80">
              <th className="border border-slate-200 px-6 py-2 align-top" />
              <th className="border border-slate-200 px-6 py-2 align-top" />
              <th className="border border-slate-200 px-6 py-2 align-top" />
              <th className="border border-slate-200 px-6 py-2 align-top" />
              <th className="border border-slate-200 px-6 py-2 align-top">
                <select
                  value={dealExecutorFilter}
                  onChange={(event) => onDealExecutorFilterChange(event.target.value)}
                  aria-label="Фильтр по исполнителю"
                  className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:border-sky-500 focus:ring focus:ring-sky-100 focus:ring-offset-0"
                >
                  <option value="">Все</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {getUserDisplayName(user)}
                    </option>
                  ))}
                </select>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white">
            {displayedDeals.length ? (
              displayedDeals.map((deal) => {
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
                  isSelected ? 'bg-sky-50 border-sky-500 shadow-sm' : '',
                  isDeleted ? 'opacity-60' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <tr
                    key={deal.id}
                    onClick={() => onSelectDeal(deal.id)}
                    className={rowClassName}
                    ref={(element) => {
                      if (deal.id === selectedDeal?.id) {
                        selectedRowRef.current = element;
                      }
                    }}
                    style={{ minHeight: '56px' }}
                  >
                    <td className={`border border-slate-200 px-6 py-3 ${deletedTextClass}`}>
                      <p className={`text-base font-semibold text-slate-900 ${deletedTextClass}`}>
                        {deal.title}
                      </p>
                      {deal.deletedAt && (
                        <p className="text-[11px] text-rose-500 mt-1">
                          Удалена: {formatDeletedAt(deal.deletedAt)}
                        </p>
                      )}
                    </td>
                    <td
                      className={`border border-slate-200 px-6 py-3 text-sm text-slate-900 ${deletedTextClass}`}
                    >
                      <span className={deletedTextClass}>{deal.clientName || '—'}</span>
                    </td>
                    <td
                      className={`border border-slate-200 px-6 py-3 text-sm font-semibold text-center ${deletedTextClass}`}
                    >
                      {deal.expectedClose ? (
                        <span className={`${deadlineTone}`}>{formatDate(deal.expectedClose)}</span>
                      ) : (
                        <span className={`text-xs text-rose-500 font-semibold ${deletedTextClass || ''}`}>
                          Нет срока
                        </span>
                      )}
                    </td>
                    <td
                      className={`border border-slate-200 px-6 py-3 text-sm text-right ${deletedTextClass}`}
                    >
                      {deal.nextContactDate ? (
                        <span className={`text-sm font-semibold text-slate-900 ${deletedTextClass}`}>
                          {formatDate(deal.nextContactDate)}
                        </span>
                      ) : (
                        <span
                          className={`text-xs text-rose-500 font-semibold uppercase tracking-wide ${deletedTextClass}`}
                        >
                          Не назначено
                        </span>
                      )}
                    </td>
                    <td
                      className={`border border-slate-200 px-6 py-3 text-sm text-slate-900 ${deletedTextClass}`}
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
                  Сделки не найдены.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {dealsHasMore && (
        <div className="border-t border-slate-100 px-4 py-3 text-center">
          <button
            type="button"
            onClick={onLoadMoreDeals}
            disabled={isLoadingMoreDeals}
            className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:text-slate-400 disabled:hover:text-slate-400"
          >
            {isLoadingMoreDeals ? 'Загрузка...' : 'Показать ещё'}
          </button>
        </div>
      )}
    </>
  );
};
