import { describe, expect, it } from 'vitest';

import { mapPolicy } from '../mappers';

describe('mapPolicy', () => {
  it('maps note and computed status', () => {
    const mapped = mapPolicy({
      id: 'p1',
      number: 'POL-1',
      insurance_company: 'c1',
      insurance_company_name: 'Company',
      insurance_type: 't1',
      insurance_type_name: 'Type',
      deal: 'd1',
      is_vehicle: false,
      status: 'active',
      computed_status: 'problem',
      note: 'Important note',
      created_at: '2026-01-01T00:00:00Z',
    });

    expect(mapped.note).toBe('Important note');
    expect(mapped.computedStatus).toBe('problem');
  });
});
