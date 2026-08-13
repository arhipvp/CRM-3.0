import React from 'react';
import { ClientNameIndicators } from '../../clients/ClientNameIndicators';
import { Button } from '../../common/Button';

import { ColoredLabel } from '../../common/ColoredLabel';
import { TableHeadCell } from '../../common/TableHeadCell';
import { DataTableShell } from '../../common/table/DataTableShell';
import { EmptyTableState } from '../../common/table/EmptyTableState';
import { TABLE_CELL_CLASS_LG, TABLE_THEAD_CLASS } from '../../common/tableStyles';

import { DealsListHeader } from './DealsListHeader';
import type { DealsListProps } from './dealsListTypes';
import { formatDate, formatDeletedAt, getDeadlineTone, getDealDeadlineBadge } from './helpers';
import {
  MAX_DEALS_LIST_HEIGHT_VIEWPORT_RATIO,
  MIN_DEALS_LIST_HEIGHT_PX,
  useDealsListController,
} from './hooks/useDealsListController';

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
  clients = [],
  clientDuplicateHints = {},
  onClientFindSimilar,
  onClientNormalizeName,
}) => {
  const {
    clientsById,
    dealsListHeight,
    getAriaSort,
    getColumnTitleClass,
    getSortIndicator,
    getSortLabel,
    handleResizeKeyDown,
    handleResizePointerDown,
    isDesktopLayout,
    selectedRowRef,
    tableScrollRef,
    toggleColumnSort,
  } = useDealsListController({
    selectedDeal,
    dealRowFocusRequest,
    dealOrdering,
    onDealOrderingChange,
    clients,
  });

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
      <DealsListHeader
        totalCount={dealsTotalCount}
        visibleCount={sortedDeals.length}
        search={dealSearch}
        onSearchChange={onDealSearchChange}
        onSearchSubmit={onDealSearchSubmit}
        onRefresh={onRefreshDealsList}
        isRefreshing={isRefreshingDealsList}
        executorFilter={dealExecutorFilter}
        onExecutorFilterChange={onDealExecutorFilterChange}
        showDeleted={dealShowDeleted}
        onShowDeletedChange={onDealShowDeletedChange}
        showClosed={dealShowClosed}
        onShowClosedChange={onDealShowClosedChange}
        users={users}
        isSelectionBlocked={isDealSelectionBlocked}
      />

      <DataTableShell>
        {isDesktopLayout && (
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
                    <Button
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
                    </Button>
                  </TableHeadCell>
                  <TableHeadCell
                    align="center"
                    className="min-w-[180px]"
                    aria-sort={getAriaSort('deadline')}
                  >
                    <Button
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
                    </Button>
                  </TableHeadCell>
                  <TableHeadCell className="min-w-[190px]">Исполнитель</TableHeadCell>
                </tr>
              </thead>
              <tbody className="bg-white">
                {sortedDeals.length ? (
                  sortedDeals.map((deal) => {
                    const deadlineTone = getDeadlineTone(deal.expectedClose);
                    const deadlineBadge = getDealDeadlineBadge(deal.expectedClose);
                    const isDeleted = Boolean(deal.deletedAt);
                    const deletedTextClass = isDeleted ? 'line-through decoration-rose-500/80' : '';
                    const isSelected = selectedDeal?.id === deal.id;
                    const isPinned = Boolean(deal.isPinned);
                    const activeDealsCount = deal.clientActiveDealsCount;
                    const dealClient = clientsById.get(deal.clientId) ?? null;
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
                          if (event.target !== event.currentTarget) {
                            return;
                          }
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
                              <Button
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
                              </Button>
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
                            <span className={`inline-flex items-center gap-2 ${deletedTextClass}`}>
                              <ClientNameIndicators
                                client={dealClient}
                                hint={dealClient ? clientDuplicateHints[dealClient.id] : undefined}
                                onFindSimilar={onClientFindSimilar}
                                onNormalizeName={onClientNormalizeName}
                              />
                              <span>{deal.clientName}</span>
                              {activeDealsCount !== undefined && (
                                <>
                                  {' '}
                                  <Button
                                    type="button"
                                    onClick={(event) =>
                                      handleClientDealsCountClick(event, deal.clientName)
                                    }
                                    className="font-semibold text-sky-700 underline decoration-dotted underline-offset-2 transition hover:text-sky-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                                    aria-label={`Показать все сделки клиента ${deal.clientName}`}
                                    title={`Показать сделки клиента ${deal.clientName}`}
                                  >
                                    ({activeDealsCount})
                                  </Button>
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
        )}
        {isDesktopLayout && (
          <Button
            type="button"
            aria-label="Изменить высоту списка сделок"
            title="Изменить высоту списка сделок"
            onPointerDown={handleResizePointerDown}
            onKeyDown={handleResizeKeyDown}
            aria-keyshortcuts="ArrowUp ArrowDown Home End"
            className="hidden h-3 w-full cursor-row-resize border-y border-slate-200 bg-slate-50 transition hover:bg-sky-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-inset md:flex md:items-center md:justify-center"
          >
            <span className="h-1 w-12 rounded-full bg-slate-300" aria-hidden="true" />
          </Button>
        )}
        {!isDesktopLayout && (
          <div className="divide-y divide-slate-200 bg-white">
            {sortedDeals.length ? (
              sortedDeals.map((deal) => {
                const deadlineBadge = getDealDeadlineBadge(deal.expectedClose);
                const isSelected = selectedDeal?.id === deal.id;
                const isPinned = Boolean(deal.isPinned);
                const isDeleted = Boolean(deal.deletedAt);
                const dealClient = clientsById.get(deal.clientId) ?? null;
                return (
                  <Button
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
                          <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-600">
                            <ClientNameIndicators
                              client={dealClient}
                              hint={dealClient ? clientDuplicateHints[dealClient.id] : undefined}
                              onFindSimilar={onClientFindSimilar}
                              onNormalizeName={onClientNormalizeName}
                            />
                            <span>{deal.clientName || '—'}</span>
                          </p>
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
                            {deal.nextContactDate
                              ? formatDate(deal.nextContactDate)
                              : 'Не назначено'}
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
                  </Button>
                );
              })
            ) : (
              <div className="px-4 py-8 text-center text-sm text-slate-500">Сделки не найдены.</div>
            )}
          </div>
        )}
      </DataTableShell>

      {dealsHasMore && (
        <div className="border-t border-slate-100 bg-slate-50/70 px-4 py-3 text-center">
          <Button
            type="button"
            onClick={onLoadMoreDeals}
            disabled={isLoadingMoreDeals}
            variant="quiet"
            size="sm"
          >
            {isLoadingMoreDeals ? 'Загрузка...' : 'Показать ещё'}
          </Button>
        </div>
      )}
    </>
  );
};
