import React from 'react';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '../../common/buttonStyles';

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
      <button
        type="button"
        onClick={onDelay}
        disabled={onDelayDisabled ?? !dealEventsLength}
        className={BTN_SECONDARY}
      >
        <span className="text-base leading-none">🕒</span>
        <span>Отложить</span>
      </button>
      <button
        type="button"
        onClick={onMerge}
        disabled={isSelectedDealDeleted}
        className={BTN_SECONDARY}
      >
        Сцепить
      </button>
    </div>

    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        disabled={
          isSelectedDealDeleted || isDealClosedStatus || isClosingDeal || !isCurrentUserSeller
        }
        className="btn btn-success"
      >
        {isClosingDeal ? 'Закрываем...' : 'Закрыть'}
      </button>

      {isDealClosedStatus && (
        <button
          type="button"
          onClick={onReopen}
          disabled={isSelectedDealDeleted || !canReopenClosedDeal || isReopeningDeal}
          className="btn btn-quiet"
        >
          {isReopeningDeal ? 'Восстанавливаем...' : 'Восстановить'}
        </button>
      )}

      {isSelectedDealDeleted ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={isRestoringDeal}
          className="btn btn-quiet"
        >
          {isRestoringDeal ? 'Восстанавливаем...' : 'Восстановить'}
        </button>
      ) : (
        <button type="button" onClick={onDelete} disabled={isDeletingDeal} className={BTN_DANGER}>
          {isDeletingDeal ? 'Удаляем...' : 'Удалить'}
        </button>
      )}
    </div>
  </div>
);
