import React from 'react';
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_QUIET,
  BTN_SECONDARY,
  BTN_SUCCESS,
} from '../../common/buttonStyles';

interface DealActionsProps {
  isSelectedDealDeleted: boolean;
  isDeletingDeal: boolean;
  isRestoringDeal: boolean;
  isDealClosedStatus: boolean;
  isClosingDeal: boolean;
  isReopeningDeal: boolean;
  isCurrentUserSeller: boolean;
  canReopenClosedDeal: boolean;
  onEdit: () => void;
  onRestore: () => void;
  onDelete: () => void;
  onClose: () => void;
  onReopen: () => void;
  onMerge: () => void;
  onSimilar: () => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
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
  onEdit,
  onRestore,
  onDelete,
  onClose,
  onReopen,
  onMerge,
  onSimilar,
  onRefresh,
  isRefreshing = false,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3 app-panel-muted p-3 shadow-none">
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onEdit}
        disabled={isSelectedDealDeleted}
        className={BTN_PRIMARY}
      >
        Редактировать
      </button>
    </div>

    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={
          isSelectedDealDeleted || isDealClosedStatus || isClosingDeal || !isCurrentUserSeller
        }
        className={BTN_SUCCESS}
      >
        {isClosingDeal ? 'Закрываем...' : 'Закрыть'}
      </button>

      {isDealClosedStatus && (
        <button
          type="button"
          onClick={onReopen}
          disabled={isSelectedDealDeleted || !canReopenClosedDeal || isReopeningDeal}
          className={BTN_QUIET}
        >
          {isReopeningDeal ? 'Восстанавливаем...' : 'Восстановить'}
        </button>
      )}

      <details className="relative">
        <summary className={`${BTN_SECONDARY} cursor-pointer list-none`}>Ещё</summary>
        <div className="absolute right-0 z-20 mt-2 flex min-w-52 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <button type="button" onClick={onRefresh} disabled={isRefreshing} className={BTN_QUIET}>
            {isRefreshing ? 'Обновляем...' : 'Обновить данные'}
          </button>
          <button
            type="button"
            onClick={onSimilar}
            disabled={isSelectedDealDeleted}
            className={BTN_QUIET}
          >
            Похожие сделки
          </button>
          <button
            type="button"
            onClick={onMerge}
            disabled={isSelectedDealDeleted}
            className={BTN_QUIET}
          >
            Объединить сделки
          </button>
          {isSelectedDealDeleted ? (
            <button
              type="button"
              onClick={onRestore}
              disabled={isRestoringDeal}
              className={BTN_QUIET}
            >
              {isRestoringDeal ? 'Восстанавливаем...' : 'Восстановить сделку'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeletingDeal}
              className={BTN_DANGER}
            >
              {isDeletingDeal ? 'Удаляем...' : 'Удалить сделку'}
            </button>
          )}
        </div>
      </details>
    </div>
  </div>
);
