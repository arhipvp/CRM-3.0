import React from 'react';

import { FormModal } from '../../common/modal/FormModal';

interface DeleteStatementModalProps {
  isOpen: boolean;
  statementName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteStatementModal: React.FC<DeleteStatementModalProps> = ({
  isOpen,
  statementName,
  onClose,
  onConfirm,
}) => {
  return (
    <FormModal
      isOpen={isOpen}
      title="Удалить ведомость"
      onClose={onClose}
      closeOnOverlayClick={false}
    >
      <p className="text-sm text-slate-700">
        Ведомость <span className="font-bold">{statementName}</span> будет удалена. Все записи
        отвяжутся от ведомости.
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" onClick={onClose} className="btn btn-secondary rounded-xl">
          Отмена
        </button>
        <button
          type="button"
          onClick={() => void onConfirm()}
          className="btn btn-danger rounded-xl"
        >
          Удалить
        </button>
      </div>
    </FormModal>
  );
};
