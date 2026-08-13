import React from 'react';

import { Button } from './Button';
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
  zIndex?: number;
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
  zIndex = 80,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal title={title} onClose={onCancel} size="sm" zIndex={zIndex} closeOnOverlayClick={false}>
      <div className="space-y-4">
        <p className="text-sm text-slate-700">{message}</p>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" onClick={onCancel} disabled={isLoading} variant="secondary">
            {cancelText}
          </Button>
          <Button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            variant={tone === 'danger' ? 'danger' : 'primary'}
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
