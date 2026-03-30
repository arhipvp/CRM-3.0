import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Payment } from '../../../../../types';
import type { IncomeExpenseRow } from '../../RecordsTable';
import { useRecordAmountEditing } from '../useRecordAmountEditing';

const buildPayment = (id: string): Payment => ({
  id,
  amount: '1000',
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
});

const buildRow = (
  overrides: Partial<IncomeExpenseRow> & Pick<IncomeExpenseRow, 'recordId' | 'recordAmount'>,
): IncomeExpenseRow => ({
  key: overrides.recordId,
  payment: overrides.payment ?? buildPayment(`payment-${overrides.recordId}`),
  recordId: overrides.recordId,
  statementId: overrides.statementId ?? 'statement-1',
  recordKind:
    overrides.recordKind ?? (overrides.recordAmount < 0 ? 'expense' : 'income'),
  recordAmount: overrides.recordAmount,
  paymentPaidBalance: overrides.paymentPaidBalance ?? 1000,
  paymentPaidEntries: overrides.paymentPaidEntries ?? [],
  recordDate: overrides.recordDate ?? '2026-03-10',
  recordDescription: overrides.recordDescription ?? 'Описание',
  recordSource: overrides.recordSource ?? 'Источник',
  recordNote: overrides.recordNote ?? 'Примечание',
  dealId: overrides.dealId ?? null,
  dealTitle: overrides.dealTitle ?? null,
  dealClientName: overrides.dealClientName ?? null,
  policyId: overrides.policyId ?? null,
  policyNumber: overrides.policyNumber ?? null,
  policyInsuranceType: overrides.policyInsuranceType ?? null,
  policyClientName: overrides.policyClientName ?? null,
  policyInsuredClientName: overrides.policyInsuredClientName ?? null,
  salesChannelName: overrides.salesChannelName ?? null,
  paymentActualDate: overrides.paymentActualDate ?? null,
  paymentScheduledDate: overrides.paymentScheduledDate ?? null,
});

describe('useRecordAmountEditing', () => {
  it('keeps equivalent amount when switching row between rubles and percent', () => {
    const row = buildRow({ recordId: 'record-1', recordAmount: 200, paymentPaidBalance: 1000 });
    const { result } = renderHook(() => useRecordAmountEditing({}));

    act(() => {
      result.current.toggleRecordAmountMode(row);
    });

    expect(result.current.amountDrafts['record-1']).toEqual({ mode: 'percent', value: '20' });

    act(() => {
      result.current.toggleRecordAmountMode(row);
    });

    expect(result.current.amountDrafts['record-1']).toEqual({ mode: 'rub', value: '200' });
  });

  it('does not allow switching a row to percent when saldo is zero', () => {
    const row = buildRow({ recordId: 'record-1', recordAmount: 200, paymentPaidBalance: 0 });
    const { result } = renderHook(() => useRecordAmountEditing({}));

    act(() => {
      result.current.toggleRecordAmountMode(row);
    });

    expect(result.current.amountDrafts['record-1']).toBeUndefined();
  });

  it('applies the same ruble amount to all unlocked rows in the statement', async () => {
    const onUpdateFinancialRecord = vi.fn().mockResolvedValue(undefined);
    const rows = [
      buildRow({ recordId: 'record-1', recordAmount: 50, paymentPaidBalance: 1000 }),
      buildRow({ recordId: 'record-2', recordAmount: -70, paymentPaidBalance: 2000 }),
      buildRow({ recordId: 'record-3', recordAmount: 90, paymentPaidBalance: 3000 }),
    ];
    const { result } = renderHook(() =>
      useRecordAmountEditing({
        onUpdateFinancialRecord,
        isRowAmountLocked: (row) => row.recordId === 'record-3',
      }),
    );

    act(() => {
      result.current.handleStatementAmountChange('150');
    });

    await act(async () => {
      await result.current.applyStatementAmountToRows(rows);
    });

    expect(onUpdateFinancialRecord).toHaveBeenCalledTimes(2);
    expect(onUpdateFinancialRecord).toHaveBeenNthCalledWith(
      1,
      'record-1',
      expect.objectContaining({ amount: '150', recordType: 'income' }),
    );
    expect(onUpdateFinancialRecord).toHaveBeenNthCalledWith(
      2,
      'record-2',
      expect.objectContaining({ amount: '150', recordType: 'expense' }),
    );
  });

  it('applies percent amount relative to each row saldo', async () => {
    const onUpdateFinancialRecord = vi.fn().mockResolvedValue(undefined);
    const rows = [
      buildRow({ recordId: 'record-1', recordAmount: 50, paymentPaidBalance: 1000 }),
      buildRow({ recordId: 'record-2', recordAmount: 70, paymentPaidBalance: 2500 }),
    ];
    const { result } = renderHook(() =>
      useRecordAmountEditing({
        onUpdateFinancialRecord,
      }),
    );

    act(() => {
      result.current.toggleStatementAmountMode();
      result.current.handleStatementAmountChange('10');
    });

    await act(async () => {
      await result.current.applyStatementAmountToRows(rows);
    });

    expect(onUpdateFinancialRecord).toHaveBeenCalledTimes(2);
    expect(onUpdateFinancialRecord).toHaveBeenNthCalledWith(
      1,
      'record-1',
      expect.objectContaining({ amount: '100' }),
    );
    expect(onUpdateFinancialRecord).toHaveBeenNthCalledWith(
      2,
      'record-2',
      expect.objectContaining({ amount: '250' }),
    );
  });

  it('preserves expense type for zero-amount expense rows during update', async () => {
    const onUpdateFinancialRecord = vi.fn().mockResolvedValue(undefined);
    const row = buildRow({
      recordId: 'record-zero-expense',
      recordAmount: 0,
      recordKind: 'expense',
    });
    const { result } = renderHook(() =>
      useRecordAmountEditing({
        onUpdateFinancialRecord,
      }),
    );

    act(() => {
      result.current.handleRecordAmountChange(row.recordId, '25');
    });

    await act(async () => {
      await result.current.handleRecordAmountBlur(row);
    });

    expect(onUpdateFinancialRecord).toHaveBeenCalledWith(
      'record-zero-expense',
      expect.objectContaining({ amount: '25', recordType: 'expense' }),
    );
  });
});
