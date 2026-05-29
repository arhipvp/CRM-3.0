import { describe, expect, it } from 'vitest';

import type { FinancialRecord, Payment, Statement } from '../../../types';
import {
  applyStatementAggregates,
  mergeFinancialRecords,
  mergePaymentFinancialRecords,
  normalizeFinancialRecordAmount,
} from '../financeActionHelpers';

const statement = (id: string): Statement =>
  ({
    id,
    name: id,
    statementType: 'income',
    status: 'draft',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  }) as Statement;

const record = (overrides: Partial<FinancialRecord>): FinancialRecord =>
  ({
    id: 'record-1',
    paymentId: 'payment-1',
    amount: '0.00',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as FinancialRecord;

describe('financeActionHelpers', () => {
  it('normalizes expense amounts as negative and income amounts as positive', () => {
    expect(
      normalizeFinancialRecordAmount({
        paymentId: 'payment-1',
        recordType: 'expense',
        amount: '150.25',
        date: '',
        description: '',
        source: '',
        note: '',
      }),
    ).toBe(-150.25);
    expect(
      normalizeFinancialRecordAmount({
        paymentId: 'payment-1',
        recordType: 'income',
        amount: '-75',
        date: '',
        description: '',
        source: '',
        note: '',
      }),
    ).toBe(75);
  });

  it('aggregates only active records linked to statements', () => {
    const result = applyStatementAggregates(
      [statement('statement-1'), statement('statement-2')],
      [
        record({ id: 'record-1', statementId: 'statement-1', amount: '100.50' }),
        record({ id: 'record-2', statementId: 'statement-1', amount: '-20.25' }),
        record({
          id: 'record-3',
          statementId: 'statement-1',
          amount: '999',
          deletedAt: '2026-01-02',
        }),
        record({ id: 'record-4', statementId: null, amount: '999' }),
        record({ id: 'record-5', amount: '999' }),
      ],
    );

    expect(result[0]).toMatchObject({ recordsCount: 2, totalAmount: '80.25' });
    expect(result[1]).toMatchObject({ recordsCount: 0, totalAmount: '0.00' });
  });

  it('updates existing financial records and appends new records', () => {
    const current = [
      record({ id: 'record-1', amount: '100.00' }),
      record({ id: 'record-2', amount: '200.00' }),
    ];
    const incoming = [
      record({ id: 'record-2', amount: '250.00' }),
      record({ id: 'record-3', amount: '300.00' }),
    ];

    expect(mergeFinancialRecords(current, incoming).map((item) => [item.id, item.amount])).toEqual([
      ['record-1', '100.00'],
      ['record-2', '250.00'],
      ['record-3', '300.00'],
    ]);
  });

  it('merges incoming records into their payments without duplicating existing ids', () => {
    const payments: Payment[] = [
      {
        id: 'payment-1',
        amount: '100.00',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        financialRecords: [record({ id: 'record-1', amount: '100.00' })],
      } as Payment,
      {
        id: 'payment-2',
        amount: '200.00',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      } as Payment,
    ];
    const result = mergePaymentFinancialRecords(payments, [
      record({ id: 'record-1', paymentId: 'payment-1', amount: '125.00' }),
      record({ id: 'record-2', paymentId: 'payment-1', amount: '50.00' }),
      record({ id: 'record-3', paymentId: 'missing-payment', amount: '999.00' }),
    ]);

    expect(result[0].financialRecords?.map((item) => [item.id, item.amount])).toEqual([
      ['record-1', '125.00'],
      ['record-2', '50.00'],
    ]);
    expect(result[1].financialRecords).toBeUndefined();
  });
});
