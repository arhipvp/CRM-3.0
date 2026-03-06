import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCommissionsRows } from '../useCommissionsRows';

describe('useCommissionsRows', () => {
  it('builds all-record rows from enriched financial record payload even when payments are not loaded', () => {
    const { result } = renderHook(() =>
      useCommissionsRows({
        payments: [],
        allRecords: [
          {
            id: 'record-1',
            paymentId: 'payment-1',
            paymentDescription: 'Комиссия агента',
            paymentAmount: '15000',
            paymentActualDate: '2026-03-06',
            dealId: 'deal-1',
            dealTitle: 'Сделка №1',
            dealClientName: 'Мария',
            policyId: 'policy-1',
            policyNumber: 'AA-001',
            policyInsuranceType: 'КАСКО',
            policyClientName: 'Мария',
            policyInsuredClientName: 'Мария',
            salesChannelName: 'Партнеры',
            amount: '2500',
            recordType: 'Доход',
            createdAt: '2026-03-06T10:00:00Z',
            updatedAt: '2026-03-06T10:00:00Z',
          },
        ],
        paymentsById: new Map(),
        selectedStatementId: null,
        viewMode: 'all',
      }),
    );

    expect(result.current.filteredRows).toHaveLength(1);
    expect(result.current.filteredRows[0]).toMatchObject({
      recordId: 'record-1',
      dealId: 'deal-1',
      dealTitle: 'Сделка №1',
      dealClientName: 'Мария',
      policyId: 'policy-1',
      policyNumber: 'AA-001',
      policyInsuranceType: 'КАСКО',
      policyClientName: 'Мария',
      salesChannelName: 'Партнеры',
      paymentActualDate: '2026-03-06',
      recordAmount: 2500,
    });
    expect(result.current.filteredRows[0].payment.id).toBe('payment-1');
    expect(result.current.filteredRows[0].payment.amount).toBe('15000');
  });
});
