import React from 'react';

import type { Payment, Policy } from '../../types';
import { Modal } from '../Modal';
import { AddPaymentForm, AddPaymentFormValues } from '../forms/AddPaymentForm';

interface PaymentModalProps {
  isOpen: boolean;
  title: string;
  payment?: Payment;
  dealId?: string;
  dealTitle?: string;
  policies?: Policy[];
  fixedPolicyId?: string;
  onSubmit: (values: AddPaymentFormValues) => Promise<void>;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  title,
  payment,
  dealId,
  dealTitle,
  policies,
  fixedPolicyId,
  onSubmit,
  onClose,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal title={title} onClose={onClose} size="sm" zIndex={50} closeOnOverlayClick={false}>
      <AddPaymentForm
        payment={payment}
        dealId={dealId}
        dealTitle={dealTitle}
        policies={policies}
        fixedPolicyId={fixedPolicyId}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Modal>
  );
};
