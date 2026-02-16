import React from 'react';

import type { Payment, Policy } from '../../types';
import { AddPaymentForm, AddPaymentFormValues } from '../forms/AddPaymentForm';
import { FormModal } from '../common/modal/FormModal';

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
  return (
    <FormModal
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      size="sm"
      zIndex={50}
      closeOnOverlayClick={false}
    >
      <AddPaymentForm
        payment={payment}
        dealId={dealId}
        dealTitle={dealTitle}
        policies={policies}
        fixedPolicyId={fixedPolicyId}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </FormModal>
  );
};
