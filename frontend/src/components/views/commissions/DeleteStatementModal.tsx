import React from 'react';

import { BTN_DANGER, BTN_SECONDARY } from '../../common/buttonStyles';
import { FormActions } from '../../common/forms/FormActions';
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
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onConfirm();
        }}
      >
        <p className="text-sm text-slate-700">
          Ведомость <span className="font-bold">{statementName}</span> будет удалена. Все записи
          отвяжутся от ведомости.
        </p>
        <FormActions
          onCancel={onClose}
          submitLabel="Удалить"
          submitClassName={`${BTN_DANGER} rounded-xl`}
          cancelClassName={`${BTN_SECONDARY} rounded-xl`}
        />
      </form>
    </FormModal>
  );
};
