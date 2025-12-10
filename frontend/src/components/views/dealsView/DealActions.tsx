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
  <div className="flex flex-wrap justify-end gap-2">
    <button
      type="button"
      onClick={onEdit}
      disabled={isSelectedDealDeleted}
      className="px-4 py-1.5 text-sm font-semibold rounded-full border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Редактировать
    </button>
    {isSelectedDealDeleted ? (
      <button
        type="button"
        onClick={onRestore}
        disabled={isRestoringDeal}
        className="px-4 py-1.5 text-sm font-semibold rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isRestoringDeal ? 'Восстанавливаем...' : 'Восстановить'}
      </button>
    ) : (
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeletingDeal}
        className="px-4 py-1.5 text-sm font-semibold rounded-full border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDeletingDeal ? 'Удаляем...' : 'Удалить'}
      </button>
    )}
    <button
      type="button"
      onClick={onClose}
      disabled={
        isSelectedDealDeleted ||
        isDealClosedStatus ||
        isClosingDeal ||
        !isCurrentUserSeller
      }
      className="px-4 py-1.5 text-sm font-semibold rounded-full bg-emerald-600 text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {isClosingDeal ? 'Закрываем...' : 'Закрыть'}
    </button>
    {isDealClosedStatus && (
      <button
        type="button"
        onClick={onReopen}
        disabled={
          isSelectedDealDeleted || !canReopenClosedDeal || isReopeningDeal
        }
        className="px-4 py-1.5 text-sm font-semibold rounded-full bg-amber-600 text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isReopeningDeal ? 'Восстанавливаем...' : 'Восстановить'}
      </button>
    )}
    <button
      type="button"
      onClick={onMerge}
      disabled={isSelectedDealDeleted}
      className="px-4 py-1.5 text-sm font-semibold rounded-full bg-sky-600 text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      Сцепить
    </button>
    <button
      type="button"
      onClick={onDelay}
      disabled={onDelayDisabled ?? !dealEventsLength}
      className="flex items-center justify-center gap-1 rounded-full border border-slate-200 bg-emerald-100 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <span className="text-base leading-none">👑</span>
      <span>Отложить</span>
    </button>
  </div>
);
