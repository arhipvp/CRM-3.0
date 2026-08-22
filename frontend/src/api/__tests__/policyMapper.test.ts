import { describe, expect, it } from 'vitest';

import { mapPolicy, mapQuote } from '../mappers';

describe('mapPolicy', () => {
  it('maps note, renewal flag and computed status', () => {
    const mapped = mapPolicy({
      id: 'p1',
      number: 'POL-1',
      insurance_company: 'c1',
      insurance_company_name: 'Company',
      insurance_company_logo_url: 'https://cdn.example.test/company.svg',
      insurance_type: 't1',
      insurance_type_name: 'Type',
      deal: 'd1',
      is_vehicle: false,
      status: 'active',
      computed_status: 'problem',
      is_renewed: true,
      note: 'Important note',
      deductible: '15000.00',
      official_dealer: null,
      gap: false,
      created_at: '2026-01-01T00:00:00Z',
    });

    expect(mapped.note).toBe('Important note');
    expect(mapped.computedStatus).toBe('problem');
    expect(mapped.isRenewed).toBe(true);
    expect(mapped.deductible).toBe(15000);
    expect(mapped.officialDealer).toBeNull();
    expect(mapped.gap).toBe(false);
    expect(mapped.insuranceCompanyLogoUrl).toBe('https://cdn.example.test/company.svg');
  });
});

describe('mapQuote', () => {
  it('maps the insurance company logo URL', () => {
    const mapped = mapQuote({
      id: 'q1',
      deal: 'd1',
      insurance_company: 'c1',
      insurance_company_name: 'Company',
      insurance_company_logo_url: 'https://cdn.example.test/company.svg',
      insurance_type: 't1',
      insurance_type_name: 'Type',
      sum_insured: '100000',
      premium: '5000',
      created_at: '2026-01-01T00:00:00Z',
    });

    expect(mapped.insuranceCompanyLogoUrl).toBe('https://cdn.example.test/company.svg');
  });
});
