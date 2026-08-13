import React from 'react';
import { Button, DisclosureSummary } from '../../common/Button';

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
      <Button
        type="button"
        onClick={onEdit}
        disabled={isSelectedDealDeleted}
        variant="primary"
        icon="edit"
      >
        Редактировать
      </Button>
    </div>

    <div className="flex flex-wrap items-center justify-end gap-2">
      <Button
        type="button"
        onClick={onClose}
        disabled={
          isSelectedDealDeleted || isDealClosedStatus || isClosingDeal || !isCurrentUserSeller
        }
        variant="success"
        icon="check"
      >
        {isClosingDeal ? 'Закрываем...' : 'Закрыть'}
      </Button>

      {isDealClosedStatus && (
        <Button
          type="button"
          onClick={onReopen}
          disabled={isSelectedDealDeleted || !canReopenClosedDeal || isReopeningDeal}
          variant="quiet"
        >
          {isReopeningDeal ? 'Восстанавливаем...' : 'Восстановить'}
        </Button>
      )}

      <details className="relative">
        <DisclosureSummary className="cursor-pointer list-none">Ещё</DisclosureSummary>
        <div className="absolute right-0 z-20 mt-2 flex min-w-52 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <Button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            variant="quiet"
            icon="refresh"
          >
            {isRefreshing ? 'Обновляем...' : 'Обновить данные'}
          </Button>
          <Button
            type="button"
            onClick={onSimilar}
            disabled={isSelectedDealDeleted}
            variant="quiet"
          >
            Похожие сделки
          </Button>
          <Button
            type="button"
            onClick={onMerge}
            disabled={isSelectedDealDeleted}
            variant="quiet"
            icon="duplicate"
          >
            Объединить сделки
          </Button>
          {isSelectedDealDeleted ? (
            <Button type="button" onClick={onRestore} disabled={isRestoringDeal} variant="quiet">
              {isRestoringDeal ? 'Восстанавливаем...' : 'Восстановить сделку'}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={onDelete}
              disabled={isDeletingDeal}
              variant="danger"
              icon="delete"
            >
              {isDeletingDeal ? 'Удаляем...' : 'Удалить сделку'}
            </Button>
          )}
        </div>
      </details>
    </div>
  </div>
);
