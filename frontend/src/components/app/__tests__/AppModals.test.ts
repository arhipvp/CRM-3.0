import { describe, expect, it } from 'vitest';

import { splitFinancialRecords } from '../AppModals';
import type { FinancialRecord } from '../../../types';

const buildRecord = (overrides: Partial<FinancialRecord>): FinancialRecord => ({
  id: overrides.id ?? 'record-id',
  paymentId: overrides.paymentId ?? 'payment-id',
  amount: overrides.amount ?? '0.00',
  date: overrides.date ?? null,
  description: overrides.description ?? '',
  source: overrides.source ?? '',
  note: overrides.note ?? '',
  recordType: overrides.recordType,
  createdAt: overrides.createdAt ?? '2026-03-19T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2026-03-19T00:00:00Z',
  deletedAt: overrides.deletedAt ?? null,
});

describe('splitFinancialRecords', () => {
  it('prefers recordType over amount sign for legacy inconsistent expenses', () => {
    const records = [
      buildRecord({
        id: 'expense-id',
        amount: '2717.00',
        recordType: 'Расход',
      }),
    ];

    const { incomes, expenses } = splitFinancialRecords(records);

    expect(incomes).toHaveLength(0);
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.id).toBe('expense-id');
    expect(expenses[0]?.amount).toBe('2717');
  });

  it('falls back to amount sign when recordType is missing', () => {
    const records = [
      buildRecord({
        id: 'negative-id',
        amount: '-15.00',
      }),
    ];

    const { incomes, expenses } = splitFinancialRecords(records);

    expect(incomes).toHaveLength(0);
    expect(expenses).toHaveLength(1);
    expect(expenses[0]?.id).toBe('negative-id');
  });
});
