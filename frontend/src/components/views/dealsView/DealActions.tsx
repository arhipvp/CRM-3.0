import React from 'react';

interface DealActionsProps {
  isSelectedDealDeleted: boolean;
  isDeletingDeal: boolean;
  isRestoringDeal: boolean;
  isDealClosedStatus: boolean;
  isClosingDeal: boolean;
  isReopeningDeal: boolean;
  isCurrentUserSeller: boolean;
  canReopenClosedDeal: boolean;
  dealEventsLength: number;
  onEdit: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onClose: () => void;
  onReopen: () => void;
  onMerge: () => void;
  onDelay: () => void;
  onDelayDisabled?: boolean;
}

export const DealActions: React.FC<DealActionsProps> = ({
  isSelectedDealDeleted,
  isDeletingDeal,
  isRestoringDeal,
  isDealClosedStatus,
  isClosingDeal,
  isReopeningDeal,
  isCurrentUserSeller,
  canReopenClosedDeal,
  dealEventsLength,
  onEdit,
  onRestore,
  onDelete,
  onClose,
  onReopen,
  onMerge,
  onDelay,
  onDelayDisabled,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        disabled={isSelectedDealDeleted}
        className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Редактировать
      </button>
      <button
        type="button"
        onClick={onDelay}
        disabled={onDelayDisabled ?? !dealEventsLength}
        className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <span className="text-base leading-none">🕒</span>
        <span>Отложить</span>
      </button>
      <button
        type="button"
        onClick={onMerge}
        disabled={isSelectedDealDeleted}
        className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Сцепить
      </button>
    </div>

    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={
          isSelectedDealDeleted ||
          isDealClosedStatus ||
          isClosingDeal ||
          !isCurrentUserSeller
        }
        className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isClosingDeal ? 'Закрываем...' : 'Закрыть'}
      </button>

      {isDealClosedStatus && (
        <button
          type="button"
          onClick={onReopen}
          disabled={isSelectedDealDeleted || !canReopenClosedDeal || isReopeningDeal}
          className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-white px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isReopeningDeal ? 'Восстанавливаем...' : 'Восстановить'}
        </button>
      )}

      {isSelectedDealDeleted ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={isRestoringDeal}
          className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isRestoringDeal ? 'Восстанавливаем...' : 'Восстановить'}
        </button>
      ) : (
        <button
          type="button"
          onClick={onDelete}
          disabled={isDeletingDeal}
          className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeletingDeal ? 'Удаляем...' : 'Удалить'}
        </button>
      )}
    </div>
  </div>
);

