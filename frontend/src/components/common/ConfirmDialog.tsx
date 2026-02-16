import React from 'react';

import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from './buttonStyles';
import { Modal } from '../Modal';

type ConfirmTone = 'danger' | 'primary';

interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: ConfirmTone;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title = 'Подтверждение действия',
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  tone = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) {
    return null;
  }

  const confirmClassName = tone === 'danger' ? BTN_DANGER : BTN_PRIMARY;

  return (
    <Modal title={title} onClose={onCancel} size="sm" closeOnOverlayClick={false}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onCancel} disabled={isLoading} className={BTN_SECONDARY}>
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={confirmClassName}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};
