import React from 'react';

import type { FinancialRecord } from '../../types';
import { Modal } from '../Modal';
import { AddFinancialRecordForm, AddFinancialRecordFormValues } from '../forms/AddFinancialRecordForm';

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
  if (!isOpen) {
    return null;
  }

  const resolvedPaymentId = record?.paymentId || paymentId;

  return (
    <Modal title={title} onClose={onClose} size="sm" zIndex={50} closeOnOverlayClick={false}>
      <AddFinancialRecordForm
        paymentId={resolvedPaymentId}
        defaultRecordType={defaultRecordType}
        record={record}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Modal>
  );
};

