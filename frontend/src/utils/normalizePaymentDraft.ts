import { createEmptyRecord } from '../components/forms/addPolicy/types';
import type { PaymentDraft } from '../components/forms/addPolicy/types';

interface NormalizePaymentDraftOptions {
  autoIncomeNote?: string;
  autoExpenseNote?: string;
}

export const normalizePaymentDraft = (
  payment: PaymentDraft,
  ensureExpenses: boolean,
  options?: NormalizePaymentDraftOptions,
): PaymentDraft => {
  const incomeNote = options?.autoIncomeNote ?? '';
  const expenseNote = options?.autoExpenseNote;
  const normalizedIncomes =
    payment.incomes.length > 0 ? payment.incomes : [{ ...createEmptyRecord(), note: incomeNote }];
  const normalizedExpenses =
    payment.expenses.length > 0 || !ensureExpenses
      ? payment.expenses
      : [{ ...createEmptyRecord(), note: expenseNote ?? '' }];
  return {
    ...payment,
    incomes: normalizedIncomes,
    expenses: normalizedExpenses,
  };
};
