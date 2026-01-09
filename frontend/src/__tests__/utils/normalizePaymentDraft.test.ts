import { describe, expect, it } from 'vitest';
import { normalizePaymentDraft } from '../../utils/normalizePaymentDraft';

const samplePayment = {
  amount: '100',
  description: '',
  scheduledDate: '',
  actualDate: '',
  incomes: [],
  expenses: [],
};

describe('normalizePaymentDraft', () => {
  it('fills an income record when none exist', () => {
    const result = normalizePaymentDraft(samplePayment, false, {
      autoIncomeNote: 'Комиссионное вознаграждение',
    });
    expect(result.incomes).toHaveLength(1);
    expect(result.incomes[0].amount).toBe('0');
    expect(result.incomes[0].note).toBe('Комиссионное вознаграждение');
  });

  it('keeps existing incomes', () => {
    const result = normalizePaymentDraft(
      {
        ...samplePayment,
        incomes: [{ amount: '10', date: '', description: '', source: '', note: '' }],
      },
      false,
    );
    expect(result.incomes).toHaveLength(1);
    expect(result.incomes[0].amount).toBe('10');
  });

  it('adds default expense when ensureExpenses=true and none provided', () => {
    const result = normalizePaymentDraft(samplePayment, true, {
      autoExpenseNote: 'Расход контрагенту Клиент',
    });
    expect(result.expenses).toHaveLength(1);
    expect(result.expenses[0].amount).toBe('0');
    expect(result.expenses[0].note).toBe('Расход контрагенту Клиент');
  });

  it('does not add expense when ensureExpenses=false', () => {
    const result = normalizePaymentDraft(samplePayment, false);
    expect(result.expenses).toHaveLength(0);
  });
});
