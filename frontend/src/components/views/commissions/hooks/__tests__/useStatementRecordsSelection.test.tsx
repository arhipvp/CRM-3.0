import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Payment, Statement } from '../../../../../types';
import type { IncomeExpenseRow } from '../../RecordsTable';
import { useStatementRecordsSelection } from '../useStatementRecordsSelection';

const buildPayment = (id: string): Payment => ({
  id,
  amount: '1000',
  createdAt: '2026-03-01T00:00:00Z',
  updatedAt: '2026-03-01T00:00:00Z',
});

const buildStatement = (
  overrides: Partial<Statement> & Pick<Statement, 'id' | 'statementType'>,
): Statement => ({
  id: overrides.id,
  name: overrides.name ?? 'Тестовая ведомость',
  statementType: overrides.statementType,
  status: overrides.status ?? 'draft',
  createdAt: overrides.createdAt ?? '2026-03-01T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2026-03-01T00:00:00Z',
  paidAt: overrides.paidAt ?? null,
});

const buildRow = (
  overrides: Partial<IncomeExpenseRow> &
    Pick<IncomeExpenseRow, 'recordId' | 'recordAmount' | 'recordKind'>,
): IncomeExpenseRow => ({
  key: overrides.recordId,
  payment: overrides.payment ?? buildPayment(`payment-${overrides.recordId}`),
  recordId: overrides.recordId,
  statementId: overrides.statementId ?? null,
  recordKind: overrides.recordKind,
  recordAmount: overrides.recordAmount,
  paymentPaidBalance: overrides.paymentPaidBalance,
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

describe('useStatementRecordsSelection', () => {
  it('uses record kind instead of amount sign for non-zero rows', () => {
    const attachStatement = buildStatement({ id: 'statement-income', statementType: 'income' });
    const row = buildRow({
      recordId: 'record-explicit-income',
      recordAmount: 0.01,
      recordKind: 'income',
    });

    const { result } = renderHook(() =>
      useStatementRecordsSelection({
        attachStatement,
        selectedStatement: undefined,
        isAttachStatementPaid: false,
        filteredRows: [row],
        viewMode: 'all',
        onUpdateStatement: vi.fn(),
        onRemoveStatementRecords: vi.fn(),
        onRefreshAllRecords: vi.fn().mockResolvedValue(undefined),
        onRefreshStatementRecords: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(result.current.canAttachRow(row)).toBe(true);
  });

  it('keeps zero-amount rows unavailable for attaching to statements', () => {
    const attachStatement = buildStatement({ id: 'statement-income', statementType: 'income' });
    const zeroIncomeRow = buildRow({
      recordId: 'record-zero-income',
      recordAmount: 0,
      recordKind: 'income',
    });

    const { result } = renderHook(() =>
      useStatementRecordsSelection({
        attachStatement,
        selectedStatement: undefined,
        isAttachStatementPaid: false,
        filteredRows: [zeroIncomeRow],
        viewMode: 'all',
        onUpdateStatement: vi.fn(),
        onRemoveStatementRecords: vi.fn(),
        onRefreshAllRecords: vi.fn().mockResolvedValue(undefined),
        onRefreshStatementRecords: vi.fn().mockResolvedValue(undefined),
      }),
    );

    expect(result.current.canAttachRow(zeroIncomeRow)).toBe(false);
    expect(result.current.selectableRecordIds).toEqual([]);
  });
});
