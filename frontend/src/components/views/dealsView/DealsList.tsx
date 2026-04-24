import React, { useCallback, useEffect, useRef, useState } from 'react';
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
type DeadlineBadge = {
  label: string;
  className: string;
};

const DEALS_LIST_HEIGHT_STORAGE_KEY = 'crm:deals:list-height';
const DEFAULT_DEALS_LIST_HEIGHT = '26vh';
const MIN_DEALS_LIST_HEIGHT_PX = 220;
const MAX_DEALS_LIST_HEIGHT_VIEWPORT_RATIO = 0.7;

const getMaxDealsListHeight = () => {
  if (typeof window === 'undefined') {
    return 760;
  }
  return Math.max(
    MIN_DEALS_LIST_HEIGHT_PX,
    Math.round(window.innerHeight * MAX_DEALS_LIST_HEIGHT_VIEWPORT_RATIO),
  );
};

const clampDealsListHeight = (height: number) =>
  Math.min(Math.max(Math.round(height), MIN_DEALS_LIST_HEIGHT_PX), getMaxDealsListHeight());

const parseStoredDealsListHeight = (raw: string | null) => {
  if (!raw) {
    return null;
  }
  if (!/^\d+px$/.test(raw)) {
    return null;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return `${clampDealsListHeight(parsed)}px`;
};

interface DealsListProps {
  sortedDeals: Deal[];
  selectedDeal: Deal | null;
  dealRowFocusRequest?: { dealId: string; nonce: number } | null;
  dealSearch: string;
  onDealSearchChange: (value: string) => void;
  onDealSearchSubmit: (value?: string) => void;
  onRefreshDealsList?: () => Promise<void>;
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
  isRefreshingDealsList?: boolean;
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
  onDealSearchSubmit,
  onRefreshDealsList,
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
  isRefreshingDealsList = false,
  onLoadMoreDeals,
  onSelectDeal,
  onPinDeal,
  onUnpinDeal,
  currentUser,
  isDealSelectionBlocked = false,
}) => {
  const selectedRowRef = useRef<HTMLTableRowElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const lastHandledFocusNonceRef = useRef<number | null>(null);
  const [dealsListHeight, setDealsListHeight] = useState(DEFAULT_DEALS_LIST_HEIGHT);

  const selectedDealId = selectedDeal?.id ?? null;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const storedHeight = parseStoredDealsListHeight(
      window.localStorage.getItem(DEALS_LIST_HEIGHT_STORAGE_KEY),
    );
    if (storedHeight) {
      setDealsListHeight(storedHeight);
    }
  }, []);

  const saveDealsListHeight = useCallback((height: number) => {
    const clampedHeight = clampDealsListHeight(height);
    const nextHeight = `${clampedHeight}px`;
    setDealsListHeight(nextHeight);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(DEALS_LIST_HEIGHT_STORAGE_KEY, nextHeight);
    }
  }, []);

  const handleResizePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!tableScrollRef.current) {
        return;
      }
      event.preventDefault();
      event.currentTarget.setPointerCapture?.(event.pointerId);

      const startY = event.clientY;
      const startHeight = tableScrollRef.current.getBoundingClientRect().height;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        saveDealsListHeight(startHeight + moveEvent.clientY - startY);
      };

      const handlePointerUp = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp, { once: true });
    },
    [saveDealsListHeight],
  );

  const getDeadlineBadge = (value?: string | null): DeadlineBadge => {
    if (!value) {
      return {
        label: 'Нет срока',
        className: 'bg-slate-100 text-slate-600 border-slate-200',
      };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(value);
    deadline.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        label: `Просрочено: ${formatDate(value)}`,
        className: 'bg-rose-50 text-rose-700 border-rose-200',
      };
    }
    if (diffDays <= 3) {
      return {
        label: `Скоро: ${formatDate(value)}`,
        className: 'bg-orange-50 text-orange-700 border-orange-200',
      };
    }
    return {
      label: formatDate(value),
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    };
  };

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
    onDealSearchSubmit(clientName);
  };

  return (
    <>
      <div className="bg-gradient-to-r from-slate-50 via-white to-blue-50/70 px-4 py-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-baseline lg:justify-between">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="text-lg font-semibold text-slate-900 whitespace-nowrap">Сделки</span>
            <span className="text-sm text-slate-500 whitespace-nowrap">
              Сделок всего {dealsTotalCount}, показано {sortedDeals.length}
            </span>
          </div>
          <div className="w-full max-w-md">
            <label htmlFor="dealSearch" className="sr-only">
              Поиск по сделкам
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onDealSearchSubmit();
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
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
                    onClick={() => onDealSearchSubmit('')}
                    aria-label="Очистить поиск сделок"
                    className="search-clear-btn"
                  >
                    ×
                  </button>
                )}
              </div>
              <button type="submit" className={BTN_SM_QUIET}>
                Найти
              </button>
              <button
                type="button"
                className={BTN_SM_QUIET}
                onClick={() => {
                  void onRefreshDealsList?.();
                }}
                disabled={!onRefreshDealsList || isRefreshingDealsList}
              >
                {isRefreshingDealsList ? 'Обновляем...' : 'Обновить'}
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="border-b border-slate-200/80 bg-white px-4 py-4">
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
        <div
          ref={tableScrollRef}
          data-testid="deals-list-scroll"
          className="hidden overflow-y-auto bg-white/95 md:block"
          style={{
            height: dealsListHeight,
            minHeight: `${MIN_DEALS_LIST_HEIGHT_PX}px`,
            maxHeight: `${MAX_DEALS_LIST_HEIGHT_VIEWPORT_RATIO * 100}vh`,
          }}
        >
          <table className="deals-table min-w-full border-collapse text-left text-sm">
            <thead className={`sticky top-0 backdrop-blur ${TABLE_THEAD_CLASS}`}>
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
                  const deadlineBadge = getDeadlineBadge(deal.expectedClose);
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
                      ? 'bg-blue-100/80 border-blue-600 shadow-sm ring-2 ring-blue-400/60 ring-inset'
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
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs ${deadlineBadge.className} ${deadlineTone}`}
                            title={deadlineBadge.label}
                          >
                            {formatDate(deal.expectedClose)}
                          </span>
                        ) : (
                          <span
                            className={`inline-flex rounded-full border px-2 py-1 text-xs ${deadlineBadge.className} ${deletedTextClass}`}
                          >
                            {deadlineBadge.label}
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
        <button
          type="button"
          aria-label="Изменить высоту списка сделок"
          title="Изменить высоту списка сделок"
          onPointerDown={handleResizePointerDown}
          className="hidden h-3 w-full cursor-row-resize border-y border-slate-200 bg-slate-50 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset md:flex md:items-center md:justify-center"
        >
          <span className="h-1 w-12 rounded-full bg-slate-300" aria-hidden="true" />
        </button>
        <div className="divide-y divide-slate-200 bg-white md:hidden">
          {sortedDeals.length ? (
            sortedDeals.map((deal) => {
              const deadlineBadge = getDeadlineBadge(deal.expectedClose);
              const isSelected = selectedDeal?.id === deal.id;
              const isPinned = Boolean(deal.isPinned);
              const isDeleted = Boolean(deal.deletedAt);
              return (
                <button
                  key={deal.id}
                  type="button"
                  onClick={() => {
                    if (!isDealSelectionBlocked) {
                      onSelectDeal(deal.id);
                    }
                  }}
                  disabled={isDealSelectionBlocked}
                  aria-label={`Открыть сделку ${deal.title}`}
                  className={`block w-full border-l-4 px-4 py-4 text-left transition ${
                    isSelected
                      ? 'border-sky-600 bg-sky-50'
                      : isPinned
                        ? 'border-rose-500 bg-white'
                        : 'border-transparent bg-white hover:border-sky-400 hover:bg-slate-50'
                  } ${isDeleted ? 'opacity-60' : ''}`}
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-base font-semibold text-slate-900">
                          {deal.title}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">{deal.clientName || '—'}</p>
                      </div>
                      {isPinned && (
                        <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                          Закреплена
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="font-semibold uppercase tracking-wide text-slate-400">
                          След. контакт
                        </p>
                        <p className="mt-1 font-semibold text-slate-900">
                          {deal.nextContactDate ? formatDate(deal.nextContactDate) : 'Не назначено'}
                        </p>
                      </div>
                      <div className="rounded-xl bg-slate-50 px-3 py-2">
                        <p className="font-semibold uppercase tracking-wide text-slate-400">
                          Крайний срок
                        </p>
                        <span
                          className={`mt-1 inline-flex rounded-full border px-2 py-1 font-semibold ${deadlineBadge.className}`}
                        >
                          {deadlineBadge.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                      <span>Исполнитель: {deal.executorName || '—'}</span>
                      {isDeleted && (
                        <span className="font-semibold text-rose-700">
                          Удалена: {formatDeletedAt(deal.deletedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Сделки не найдены.</div>
          )}
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
