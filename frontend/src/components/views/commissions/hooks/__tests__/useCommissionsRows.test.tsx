import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCommissionsRows } from '../useCommissionsRows';

describe('useCommissionsRows', () => {
  it('builds all-record rows from enriched financial record payload even when payments are not loaded', () => {
    const { result } = renderHook(() =>
      useCommissionsRows({
        statementRecords: [],
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
      recordKind: 'income',
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

  it('builds statement rows from financialRecords even when payments are not loaded', () => {
    const { result } = renderHook(() =>
      useCommissionsRows({
        statementRecords: [
          {
            id: 'record-2',
            paymentId: 'payment-2',
            statementId: 'statement-1',
            paymentDescription: 'Выплата партнера',
            paymentAmount: '8000',
            dealTitle: 'Сделка №2',
            dealClientName: 'Иван',
            amount: '-1200',
            createdAt: '2026-03-06T10:00:00Z',
            updatedAt: '2026-03-06T10:00:00Z',
          },
        ],
        allRecords: [],
        paymentsById: new Map(),
        selectedStatementId: 'statement-1',
        viewMode: 'statements',
      }),
    );

    expect(result.current.filteredRows).toHaveLength(1);
    expect(result.current.filteredRows[0]).toMatchObject({
      recordId: 'record-2',
      statementId: 'statement-1',
      recordKind: 'expense',
      dealTitle: 'Сделка №2',
      dealClientName: 'Иван',
      recordAmount: -1200,
    });
    expect(result.current.filteredRows[0].payment.id).toBe('payment-2');
    expect(result.current.filteredRows[0].payment.amount).toBe('8000');
  });

  it('sorts statement rows by actual record amount and keeps date fallback for equal amounts', () => {
    const { result } = renderHook(() =>
      useCommissionsRows({
        statementRecords: [
          {
            id: 'record-1',
            paymentId: 'payment-1',
            statementId: 'statement-1',
            amount: '300',
            date: '2026-03-02',
            createdAt: '2026-03-06T10:00:00Z',
            updatedAt: '2026-03-06T10:00:00Z',
          },
          {
            id: 'record-2',
            paymentId: 'payment-2',
            statementId: 'statement-1',
            amount: '100',
            date: '2026-03-03',
            createdAt: '2026-03-06T10:00:00Z',
            updatedAt: '2026-03-06T10:00:00Z',
          },
          {
            id: 'record-3',
            paymentId: 'payment-3',
            statementId: 'statement-1',
            amount: '300',
            date: '2026-03-04',
            createdAt: '2026-03-06T10:00:00Z',
            updatedAt: '2026-03-06T10:00:00Z',
          },
        ],
        allRecords: [],
        paymentsById: new Map(),
        selectedStatementId: 'statement-1',
        viewMode: 'statements',
      }),
    );

    act(() => {
      result.current.toggleAmountSort();
    });

    expect(result.current.filteredRows.map((row) => row.recordId)).toEqual([
      'record-2',
      'record-3',
      'record-1',
    ]);

    act(() => {
      result.current.toggleAmountSort();
    });

    expect(result.current.filteredRows.map((row) => row.recordId)).toEqual([
      'record-3',
      'record-1',
      'record-2',
    ]);
  });

  it('keeps zero income records visible in the all-records list', () => {
    const { result } = renderHook(() =>
      useCommissionsRows({
        statementRecords: [],
        allRecords: [
          {
            id: 'record-zero-income',
            paymentId: 'payment-zero-income',
            amount: '0',
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
      recordId: 'record-zero-income',
      recordKind: 'income',
      recordAmount: 0,
    });
  });

  it('keeps zero expense records visible in the all-records list', () => {
    const { result } = renderHook(() =>
      useCommissionsRows({
        statementRecords: [],
        allRecords: [
          {
            id: 'record-zero-expense',
            paymentId: 'payment-zero-expense',
            amount: '0',
            recordType: 'Расход',
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
      recordId: 'record-zero-expense',
      recordKind: 'expense',
      recordAmount: 0,
    });
  });

  it('keeps zero records visible inside a selected statement and preserves their type', () => {
    const { result } = renderHook(() =>
      useCommissionsRows({
        statementRecords: [
          {
            id: 'record-zero-expense',
            paymentId: 'payment-zero-expense',
            statementId: 'statement-1',
            amount: '0',
            recordType: 'Расход',
            createdAt: '2026-03-06T10:00:00Z',
            updatedAt: '2026-03-06T10:00:00Z',
          },
        ],
        allRecords: [],
        paymentsById: new Map(),
        selectedStatementId: 'statement-1',
        viewMode: 'statements',
      }),
    );

    expect(result.current.filteredRows).toHaveLength(1);
    expect(result.current.filteredRows[0]).toMatchObject({
      recordId: 'record-zero-expense',
      statementId: 'statement-1',
      recordKind: 'expense',
      recordAmount: 0,
    });
  });
});
