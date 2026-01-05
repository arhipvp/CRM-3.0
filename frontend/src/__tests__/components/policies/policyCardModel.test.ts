import { describe, expect, it } from 'vitest';

import type { Payment, Policy } from '../../../types';
import { buildPolicyCardModel } from '../../../components/policies/policyCardModel';
import { POLICY_PLACEHOLDER } from '../../../components/policies/text';

const createPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: 'p1',
  number: '',
  insuranceCompanyId: 'c1',
  insuranceCompany: '',
  insuranceTypeId: 't1',
  insuranceType: '',
  dealId: 'd1',
  isVehicle: false,
  status: 'active',
  createdAt: '2020-01-01',
  updatedAt: '2020-01-01',
  ...overrides,
});

describe('buildPolicyCardModel', () => {
  it('uses placeholders for empty values', () => {
    const policy = createPolicy({ number: '', insuranceCompany: '', insuranceType: '' });
    const model = buildPolicyCardModel(policy, []);
    expect(model.number).toBe(POLICY_PLACEHOLDER);
    expect(model.insuranceCompany).toBe(POLICY_PLACEHOLDER);
    expect(model.insuranceType).toBe(POLICY_PLACEHOLDER);
  });

  it('formats payments count label', () => {
    const policy = createPolicy({ number: '123' });
    const payments: Payment[] = [
      { id: 'pay1', amount: '1', createdAt: '2020-01-01', updatedAt: '2020-01-01' },
      { id: 'pay2', amount: '2', createdAt: '2020-01-01', updatedAt: '2020-01-01' },
    ];
    const model = buildPolicyCardModel(policy, payments);
    expect(model.paymentsCount).toBe(2);
    expect(model.paymentsCountLabel).toBe('2 записей');
  });

  it('keeps insured client name when present', () => {
    const policy = createPolicy({ insuredClientName: 'Insured' });
    const model = buildPolicyCardModel(policy, []);
    expect(model.client).toBe('Insured');
  });
});
