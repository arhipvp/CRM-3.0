import { describe, expect, it } from 'vitest';
import type { FinancialRecord, Payment } from '../../../../types';
import { hasUnpaidFinancialActivity, policyHasUnpaidActivity } from '../helpers';

const buildPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: overrides.id ?? 'payment-id',
  amount: overrides.amount ?? '100',
  description: overrides.description,
  note: overrides.note,
  scheduledDate: overrides.scheduledDate ?? null,
  actualDate: overrides.actualDate ?? null,
  financialRecords: overrides.financialRecords,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
});

const buildRecord = (overrides: Partial<FinancialRecord> = {}): FinancialRecord => ({
  id: overrides.id ?? 'record-id',
  paymentId: overrides.paymentId ?? 'payment-id',
  amount: overrides.amount ?? '0',
  date: overrides.date ?? null,
  description: overrides.description,
  source: overrides.source,
  note: overrides.note,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
});

describe('hasUnpaidFinancialActivity', () => {
  it('returns true when payment has no actualDate', () => {
    const payment = buildPayment({ actualDate: null });
    expect(hasUnpaidFinancialActivity(payment, [])).toBe(true);
  });

  it('returns true when a linked record lacks a date', () => {
    const payment = buildPayment({
      actualDate: '2025-01-01',
      financialRecords: [buildRecord({ date: '' })],
    });
    expect(hasUnpaidFinancialActivity(payment, [])).toBe(true);
  });

  it('returns false when payment and records are dated', () => {
    const payment = buildPayment({
      actualDate: '2025-01-01',
      financialRecords: [buildRecord({ date: '2025-01-02' })],
    });
    expect(hasUnpaidFinancialActivity(payment, [])).toBe(false);
  });
});

describe('policyHasUnpaidActivity', () => {
  it('considers records pulled from global list when payment lacks embedded records', () => {
    const payment = buildPayment({
      id: 'p-global',
      actualDate: '2025-01-01',
      financialRecords: undefined,
    });
    const allRecords = [
      buildRecord({ paymentId: 'p-global', date: '' }),
    ];
    const map = new Map<string, Payment[]>();
    map.set('policy-1', [payment]);

    expect(policyHasUnpaidActivity('policy-1', map, allRecords)).toBe(true);
  });

  it('returns false when all payments and records are paid', () => {
    const payment = buildPayment({
      id: 'p-closed',
      actualDate: '2025-01-01',
      financialRecords: [buildRecord({ date: '2025-01-02' })],
    });
    const map = new Map<string, Payment[]>();
    map.set('policy-closed', [payment]);

    expect(policyHasUnpaidActivity('policy-closed', map, [])).toBe(false);
  });
});
