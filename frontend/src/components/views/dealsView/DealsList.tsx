import React, { useMemo, useState } from 'react';
import type { Deal, User } from '../../../types';

import { ColoredLabel } from '../../common/ColoredLabel';

import {
  formatDate,
  formatDeletedAt,
  getDeadlineTone,
  getUserDisplayName,
  statusLabels,
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

  const getColumnTitleClass = (key: DealsSortKey) =>
    `text-[11px] font-semibold uppercase tracking-wide ${
      sortState.key === key
        ? 'text-rose-600 underline decoration-rose-500 decoration-2 underline-offset-2'
        : 'text-slate-500'
    }`;

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
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[10px] uppercase tracking-[0.4em] text-slate-400 whitespace-nowrap">
            Выбор
          </span>
          <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">Сделки</span>
          <span className="text-sm text-slate-500 whitespace-nowrap">Всего {displayedDeals.length}</span>
        </div>
      </div>
      <div className="px-4 py-4 space-y-4 border-b border-slate-200">
        <div>
          <label htmlFor="dealSearch" className="text-xs font-semibold text-slate-500 mb-1 block">
            Поиск
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
        <div className="max-h-[360px] overflow-y-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="sticky top-0 bg-white/80 backdrop-blur border-b border-slate-200">
              <tr>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Сделка
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Клиент
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Статус
                </th>
                <th className="px-4 py-2 min-w-[160px] align-top">
                  <button
                    type="button"
                    onClick={() => toggleColumnSort('deadline')}
                    aria-label={`Сортировать по крайнему сроку, текущий порядок ${getSortLabel(
                      'deadline'
                    )}`}
                    className="flex items-center justify-between gap-2 text-left w-full"
                  >
                    <span className={getColumnTitleClass('deadline')}>Крайний срок</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {getSortIndicator('deadline')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2 min-w-[140px] align-top">
                  <button
                    type="button"
                    onClick={() => toggleColumnSort('nextContact')}
                    aria-label={`Сортировать по следующему контакту, текущий порядок ${getSortLabel(
                      'nextContact'
                    )}`}
                    className="flex items-center justify-between gap-2 text-left w-full"
                  >
                    <span className={getColumnTitleClass('nextContact')}>След. контакт</span>
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      {getSortIndicator('nextContact')}
                    </span>
                  </button>
                </th>
                <th className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Исполнитель
                </th>
              </tr>
              <tr className="border-t border-slate-100 bg-slate-50/70">
                <th className="px-4 py-2 align-top" />
                <th className="px-4 py-2 align-top" />
                <th className="px-4 py-2 align-top" />
                <th className="px-4 py-2 align-top" />
                <th className="px-4 py-2 align-top" />
                <th className="px-4 py-2 align-top">
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
                  const isOverdue = deal.nextContactDate
                    ? new Date(deal.nextContactDate) < new Date()
                    : false;
                  const deadlineTone = getDeadlineTone(deal.expectedClose);
                  const isDeleted = Boolean(deal.deletedAt);
                  const deletedTextClass = isDeleted ? 'line-through decoration-rose-500/80' : '';
                  const isSelected = selectedDeal?.id === deal.id;
                  const rowClassName = [
                    'transition-colors',
                    'cursor-pointer',
                    isSelected ? 'bg-sky-100 border-y border-slate-300 shadow-sm' : 'hover:bg-slate-50',
                    isDeleted ? 'opacity-60' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <tr key={deal.id} onClick={() => onSelectDeal(deal.id)} className={rowClassName}>
                      <td className={`px-4 py-2 ${deletedTextClass}`}>
                        <p className={`text-base font-semibold text-slate-900 ${deletedTextClass}`}>
                          {deal.title}
                        </p>
                        <p className={`text-[11px] text-slate-500 mt-1 ${deletedTextClass}`}>
                          {deal.source || '—'}
                        </p>
                        {deal.deletedAt && (
                          <p className="text-[11px] text-rose-500 mt-1">
                            Удалена: {formatDeletedAt(deal.deletedAt)}
                          </p>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-sm text-slate-900 ${deletedTextClass}`}>
                        <span className={deletedTextClass}>{deal.clientName || '—'}</span>
                      </td>
                      <td className={`px-4 py-2 text-sm text-slate-900 ${deletedTextClass}`}>
                        <span className={`text-sm font-semibold text-slate-900 ${deletedTextClass}`}>
                          {statusLabels[deal.status]}
                        </span>
                        {deal.closingReason && (
                          <p className={`text-[11px] text-slate-500 mt-1 ${deletedTextClass}`}>
                            {deal.closingReason}
                          </p>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-sm font-semibold ${deletedTextClass}`}>
                        {deal.expectedClose ? (
                          <span className={`${deadlineTone}`}>{formatDate(deal.expectedClose)}</span>
                        ) : (
                          <span className={`text-xs text-rose-500 font-semibold ${deletedTextClass || ''}`}>
                            Нет срока
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-2 ${deletedTextClass}`}>
                        {deal.nextContactDate ? (
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-semibold text-slate-900 ${deletedTextClass}`}
                            >
                              {formatDate(deal.nextContactDate)}
                            </span>
                            <span
                              className={`px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide rounded-full ${
                                isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'
                              }`}
                            >
                              {isOverdue ? 'Просрочено' : 'Запланировано'}
                            </span>
                          </div>
                        ) : (
                          <span
                            className={`text-xs text-rose-500 font-semibold uppercase tracking-wide ${deletedTextClass}`}
                          >
                            Не назначено
                          </span>
                        )}
                      </td>
                      <td className={`px-4 py-2 text-sm text-slate-900 ${deletedTextClass}`}>
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
                  <td colSpan={6} className="px-4 py-4 text-center text-sm text-slate-500">
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
      </div>
    </>
  );
};
