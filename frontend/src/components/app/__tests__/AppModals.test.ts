import { describe, expect, it } from 'vitest';

import { buildPolicyFormValues } from '../AppModals';
import { splitFinancialRecords } from '../financialRecordDrafts';
import type { FinancialRecord, Payment, Policy } from '../../../types';

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

const buildPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: overrides.id ?? 'policy-new',
  number: overrides.number ?? 'POL-NEW',
  insuranceCompanyId: overrides.insuranceCompanyId ?? 'company-1',
  insuranceCompany: overrides.insuranceCompany ?? 'Ингосстрах',
  insuranceTypeId: overrides.insuranceTypeId ?? 'type-1',
  insuranceType: overrides.insuranceType ?? 'Каско',
  dealId: overrides.dealId ?? 'deal-1',
  isVehicle: overrides.isVehicle ?? false,
  status: overrides.status ?? 'active',
  createdAt: overrides.createdAt ?? '2026-03-19T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2026-03-19T00:00:00Z',
  isRenewed: overrides.isRenewed ?? false,
  renewedById: overrides.renewedById ?? null,
  renewedByNumber: overrides.renewedByNumber ?? null,
});

const buildPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: overrides.id ?? 'payment-id',
  dealId: overrides.dealId ?? 'deal-1',
  policyId: overrides.policyId ?? 'policy-new',
  amount: overrides.amount ?? '1000.00',
  description: overrides.description ?? '',
  scheduledDate: overrides.scheduledDate ?? '2026-03-19',
  actualDate: overrides.actualDate ?? null,
  financialRecords: overrides.financialRecords ?? [],
  createdAt: overrides.createdAt ?? '2026-03-19T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2026-03-19T00:00:00Z',
});

describe('buildPolicyFormValues', () => {
  it('prefills the previous policy renewed by the edited policy', () => {
    const editedPolicy = buildPolicy({ id: 'policy-new', number: 'POL-NEW' });
    const previousPolicy = buildPolicy({
      id: 'policy-old',
      number: 'POL-OLD',
      isRenewed: true,
      renewedById: editedPolicy.id,
    });

    const values = buildPolicyFormValues(
      editedPolicy,
      [buildPayment({ policyId: editedPolicy.id })],
      [],
      [editedPolicy, previousPolicy],
    );

    expect(values.renewsPolicyId).toBe(previousPolicy.id);
  });
});
