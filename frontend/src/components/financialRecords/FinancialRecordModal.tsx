import React from 'react';

import type { FinancialRecord } from '../../types';
import {
  AddFinancialRecordForm,
  AddFinancialRecordFormValues,
} from '../forms/AddFinancialRecordForm';
import { FormModal } from '../common/modal/FormModal';

interface FinancialRecordModalProps {
  isOpen: boolean;
  title: string;
  paymentId: string;
  defaultRecordType?: 'income' | 'expense';
  record?: FinancialRecord;
  onSubmit: (values: AddFinancialRecordFormValues) => Promise<void>;
  onClose: () => void;
}

export const FinancialRecordModal: React.FC<FinancialRecordModalProps> = ({
  isOpen,
  title,
  paymentId,
  defaultRecordType,
  record,
  onSubmit,
  onClose,
}) => {
  const resolvedPaymentId = record?.paymentId || paymentId;

  return (
    <FormModal
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      size="sm"
      zIndex={50}
      closeOnOverlayClick={false}
    >
      <AddFinancialRecordForm
        paymentId={resolvedPaymentId}
        defaultRecordType={defaultRecordType}
        record={record}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </FormModal>
  );
};
