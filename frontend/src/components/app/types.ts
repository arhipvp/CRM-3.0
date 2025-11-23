export type ModalType = null | 'client' | 'deal';

export interface PaymentModalState {
  policyId?: string;
  paymentId?: string;
}

export interface FinancialRecordModalState {
  paymentId?: string;
  recordId?: string;
}
