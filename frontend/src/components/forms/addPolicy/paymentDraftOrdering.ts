import type { PaymentDraft } from './types';

export interface PaymentDraftOrderEntry {
  payment: PaymentDraft;
  sourceIndex: number;
}

const getDateWeight = (value?: string) => {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
};

export const sortPaymentDraftEntries = (payments: PaymentDraft[]): PaymentDraftOrderEntry[] =>
  payments
    .map((payment, sourceIndex) => ({ payment, sourceIndex }))
    .sort((left, right) => {
      const leftWeight = getDateWeight(left.payment.scheduledDate);
      const rightWeight = getDateWeight(right.payment.scheduledDate);

      if (leftWeight !== rightWeight) {
        return leftWeight - rightWeight;
      }

      const idCompare = (left.payment.id ?? '').localeCompare(right.payment.id ?? '');
      if (idCompare !== 0) {
        return idCompare;
      }

      return left.sourceIndex - right.sourceIndex;
    });

export const getFirstScheduledPaymentEntry = (payments: PaymentDraft[]) =>
  sortPaymentDraftEntries(payments).find((entry) => Boolean(entry.payment.scheduledDate));
