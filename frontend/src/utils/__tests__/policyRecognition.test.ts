import { describe, expect, it } from 'vitest';

import { buildPolicyDraftFromRecognition } from '../policyRecognition';

describe('buildPolicyDraftFromRecognition', () => {
  it('marks the draft as vehicle and extracts normalized vehicle fields', () => {
    const parsed = {
      policy: {
        number: 'SYS2931598066',
        vehicle_brand: 'BMW',
        vehicle_model: 'X4',
        vehicle_vin: 'X4XXW194500P58881',
      },
      payments: [
        {
          amount: '5400.00 руб.',
          payment_date: '17.12.2025',
          actual_payment_date: '17.12.2025',
          description: 'первый платеж',
        },
      ],
    };

    const draft = buildPolicyDraftFromRecognition(parsed as Record<string, unknown>);

    expect(draft.isVehicle).toBe(true);
    expect(draft.brand).toBe('BMW');
    expect(draft.model).toBe('X4');
    expect(draft.vin).toBe('X4XXW194500P58881');
    expect(draft.payments).toHaveLength(1);
    expect(draft.payments[0]).toMatchObject({
      amount: '5400',
      scheduledDate: '2025-12-17',
      actualDate: '',
      description: 'первый платеж',
    });
    expect(draft.payments[0].incomes[0].amount).toBe('1');
  });

  it('returns an empty payments array when the document does not contain schedules', () => {
    const parsed = {
      policy: {
        number: 'SYS000',
      },
    };

    const draft = buildPolicyDraftFromRecognition(parsed as Record<string, unknown>);

    expect(draft.payments).toEqual([]);
  });
});
