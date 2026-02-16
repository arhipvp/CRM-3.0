import React from 'react';

import type { Statement } from '../../../types';
import { BTN_PRIMARY, BTN_SECONDARY } from '../../common/buttonStyles';
import { FormActions } from '../../common/forms/FormActions';
import { FormField } from '../../common/forms/FormField';
import { FormSection } from '../../common/forms/FormSection';
import { FormModal } from '../../common/modal/FormModal';

interface CreateStatementModalProps {
  isOpen: boolean;
  isSubmitting: boolean;
  form: {
    name: string;
    statementType: Statement['statementType'];
    counterparty: string;
    comment: string;
  };
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (
    updater: (prev: {
      name: string;
      statementType: Statement['statementType'];
      counterparty: string;
      comment: string;
    }) => {
      name: string;
      statementType: Statement['statementType'];
      counterparty: string;
      comment: string;
    },
  ) => void;
}

export const CreateStatementModal: React.FC<CreateStatementModalProps> = ({
  isOpen,
  isSubmitting,
  form,
  onClose,
  onSubmit,
  onFormChange,
}) => {
  return (
    <FormModal
      isOpen={isOpen}
      title="Создать ведомость"
      onClose={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
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
          <FormField label="Название" htmlFor="statementName" required>
            <input
              id="statementName"
              value={form.name}
              onChange={(event) => onFormChange((prev) => ({ ...prev, name: event.target.value }))}
              className="field field-input"
              required
              disabled={isSubmitting}
            />
          </FormField>
          <FormField
            label="Тип"
            htmlFor="statementType"
            hint="После пометки ведомости как «Выплачена» редактирование и удаление будут недоступны."
          >
            <select
              id="statementType"
              value={form.statementType}
              onChange={(event) =>
                onFormChange((prev) => ({
                  ...prev,
                  statementType: event.target.value as Statement['statementType'],
                }))
              }
              className="field field-input"
              disabled={isSubmitting}
            >
              <option value="income">Доходы</option>
              <option value="expense">Расходы</option>
            </select>
          </FormField>
          <FormField label="Контрагент" htmlFor="statementCounterparty">
            <input
              id="statementCounterparty"
              value={form.counterparty}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, counterparty: event.target.value }))
              }
              className="field field-input"
              disabled={isSubmitting}
            />
          </FormField>
          <FormField label="Комментарий" htmlFor="statementComment">
            <textarea
              id="statementComment"
              value={form.comment}
              onChange={(event) =>
                onFormChange((prev) => ({ ...prev, comment: event.target.value }))
              }
              rows={3}
              className="field-textarea"
              disabled={isSubmitting}
            />
          </FormField>
        </FormSection>
        <FormActions
          onCancel={onClose}
          isSubmitting={isSubmitting}
          submitLabel="Создать"
          submittingLabel="Создаём..."
          submitClassName={`${BTN_PRIMARY} rounded-xl`}
          cancelClassName={`${BTN_SECONDARY} rounded-xl`}
        />
      </form>
    </FormModal>
  );
};
