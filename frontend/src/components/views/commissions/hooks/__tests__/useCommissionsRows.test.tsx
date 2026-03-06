import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCommissionsRows } from '../useCommissionsRows';

describe('useCommissionsRows', () => {
  it('keeps all-record rows visible even when payment details are not loaded', () => {
    const { result } = renderHook(() =>
      useCommissionsRows({
        payments: [],
        allRecords: [
          {
            id: 'record-1',
            paymentId: 'payment-1',
            paymentDescription: 'Комиссия агента',
            paymentAmount: '15000',
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
    expect(result.current.filteredRows[0].payment.id).toBe('payment-1');
    expect(result.current.filteredRows[0].payment.amount).toBe('15000');
    expect(result.current.filteredRows[0].recordAmount).toBe(2500);
  });
});
