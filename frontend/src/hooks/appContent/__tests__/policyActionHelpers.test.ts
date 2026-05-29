import { describe, expect, it } from 'vitest';

import type { Client, FinancialRecord, SalesChannel } from '../../../types';
import {
  buildFinancialRecordUpdateDraft,
  buildPolicyRecognitionDraft,
  hasFinancialRecordDraftChanges,
  parsePolicyAmount,
  parsePolicyRecordAmount,
} from '../policyActionHelpers';

const record = (overrides: Partial<FinancialRecord>): FinancialRecord =>
  ({
    id: 'record-1',
    paymentId: 'payment-1',
    amount: '100.00',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }) as FinancialRecord;

describe('policyActionHelpers', () => {
  it('normalizes financial record drafts before comparing changes', () => {
    const existing = record({
      amount: '100,00',
      date: undefined,
      description: '  Комиссия ',
      source: ' СК ',
      note: ' ',
    });

    expect(buildFinancialRecordUpdateDraft(existing)).toEqual({
      amount: 100,
      date: null,
      description: 'Комиссия',
      source: 'СК',
      note: '',
    });
    expect(
      hasFinancialRecordDraftChanges(existing, {
        amount: 100,
        date: null,
        description: 'Комиссия',
        source: 'СК',
        note: '',
      }),
    ).toBe(false);
    expect(
      hasFinancialRecordDraftChanges(existing, {
        amount: 101,
        date: null,
        description: 'Комиссия',
        source: 'СК',
        note: '',
      }),
    ).toBe(true);
  });

  it('parses policy payment and record amounts with current sign rules', () => {
    expect(parsePolicyAmount('1 250,50')).toBe(1250.5);
    expect(parsePolicyAmount('bad')).toBe(0);
    expect(parsePolicyRecordAmount('100', 1)).toBe(100);
    expect(parsePolicyRecordAmount('100', -1)).toBe(-100);
    expect(parsePolicyRecordAmount('bad', -1)).toBeNaN();
  });

  it('builds recognition drafts with matched client, sales channel and source file ids', () => {
    const clients: Client[] = [
      { id: 'client-1', name: 'ООО Ромашка', createdAt: '', updatedAt: '' } as Client,
    ];
    const salesChannels: SalesChannel[] = [
      { id: 'channel-1', name: 'Агентский канал', createdAt: '', updatedAt: '' },
    ];

    const result = buildPolicyRecognitionDraft({
      clients,
      salesChannels,
      fileId: 'fallback-file',
      parsedFileIds: ['file-1', '', 'file-1', 'file-2'],
      parsed: {
        policy: {
          number: 'КАСКО-1',
          insurance_company: 'СК Тест',
          insurance_type: 'КАСКО',
          sales_channel_name: 'агентский',
          client_name: 'ООО Ромашка',
        },
        payments: [{ amount: '1200', payment_date: '01.02.2026' }],
      },
    });

    expect(result?.sourceFileIds).toEqual(['file-1', 'file-2']);
    expect(result?.insuranceCompanyName).toBe('СК Тест');
    expect(result?.insuranceTypeName).toBe('КАСКО');
    expect(result?.values).toMatchObject({
      number: 'КАСКО-1',
      salesChannelId: 'channel-1',
      clientId: 'client-1',
      clientName: 'ООО Ромашка',
    });
    expect(result?.values.payments[0].incomes[0].note).toBe(
      'Комиссионное вознаграждение от Агентский канал',
    );
  });
});
