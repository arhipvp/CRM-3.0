import { createEmptyRecord } from '../components/forms/addPolicy/types';
import type { PaymentDraft } from '../components/forms/addPolicy/types';

export const normalizePaymentDraft = (
  payment: PaymentDraft,
  ensureExpenses: boolean
): PaymentDraft => {
  const normalizedIncomes = payment.incomes.length
    ? payment.incomes
    : [createEmptyRecord()];
  const normalizedExpenses =
    payment.expenses.length || !ensureExpenses
      ? payment.expenses
      : [createEmptyRecord()];
  return {
    ...payment,
    incomes: normalizedIncomes,
    expenses: normalizedExpenses,
  };
};
