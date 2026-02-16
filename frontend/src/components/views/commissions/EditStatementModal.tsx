import React from 'react';

import type { Statement } from '../../../types';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../common/buttonStyles';
import { FormActions } from '../../common/forms/FormActions';
import { FormField } from '../../common/forms/FormField';
import { FormSection } from '../../common/forms/FormSection';
import { FormModal } from '../../common/modal/FormModal';

interface EditStatementModalProps {
  isOpen: boolean;
  form: {
    name: string;
    statementType: Statement['statementType'];
    counterparty: string;
    comment: string;
    paidAt: string;
  };
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (
    updater: (prev: {
      name: string;
      statementType: Statement['statementType'];
      counterparty: string;
      comment: string;
      paidAt: string;
    }) => {
      name: string;
      statementType: Statement['statementType'];
      counterparty: string;
      comment: string;
      paidAt: string;
    },
  ) => void;
}

export const EditStatementModal: React.FC<EditStatementModalProps> = ({
  isOpen,
  form,
  onClose,
  onSubmit,
  onFormChange,
}) => {
  return (
    <FormModal
      isOpen={isOpen}
      title="Редактировать ведомость"
      onClose={onClose}
      size="sm"
      closeOnOverlayClick={false}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void onSubmit();
        }}
      >
        <FormSection>
          <FormField label="Название" htmlFor="editStatementName" required>
            <input
              id="editStatementName"
              value={form.name}
              onChange={(event) => onFormChange((prev) => ({ ...prev, name: event.target.value }))}
              className="field field-input"
              required
            />
          </FormField>
          <FormField label="Тип" htmlFor="editStatementType">
            <select
              id="editStatementType"
              value={form.statementType}
              onChange={(event) =>
                onFormChange((prev) => ({
                  ...prev,
                  statementType: event.target.value as Statement['statementType'],
                }))
              }
              className="field field-input"
            >
              <option value="income">Доходы</option>
              <option value="expense">Расходы</option>
            </select>
          </FormField>
          <FormField
            label="Дата выплаты"
            htmlFor="editStatementPaidAt"
            hint="Ведомость считается выплаченной, когда указана дата выплаты. После этого редактирование и удаление будут недоступны, а всем записям будет проставлена дата."
          >
            <input
              id="editStatementPaidAt"
              type="date"
              value={form.paidAt}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, paidAt: event.target.value }))
              }
              className="field field-input"
            />
          </FormField>
          <FormField label="Контрагент" htmlFor="editStatementCounterparty">
            <input
              id="editStatementCounterparty"
              value={form.counterparty}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, counterparty: event.target.value }))
              }
              className="field field-input"
            />
          </FormField>
          <FormField label="Комментарий" htmlFor="editStatementComment">
            <textarea
              id="editStatementComment"
              value={form.comment}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, comment: event.target.value }))
              }
              rows={3}
              className="field-textarea"
            />
          </FormField>
        </FormSection>
        <FormActions
          onCancel={onClose}
          submitLabel="Сохранить"
          submitClassName={`${BTN_PRIMARY} rounded-xl`}
          cancelClassName={`${BTN_SECONDARY} rounded-xl`}
        />
      </form>
    </FormModal>
  );
};
