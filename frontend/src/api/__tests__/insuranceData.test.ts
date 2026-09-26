import { describe, expect, it, vi } from 'vitest';
import {
  isSelectableRecord,
  listInsuranceData,
  normalizeExperienceDate,
  parseDeductibles,
} from '../insuranceData';
import { request } from '../request';

vi.mock('../request', () => ({ request: vi.fn() }));

describe('insurance data API', () => {
  it('uses participant relevance and client soft deletion when selecting people', () => {
    expect(isSelectableRecord({ id: 'participant', is_current: true })).toBe(true);
    expect(isSelectableRecord({ id: 'participant', is_current: false })).toBe(false);
    expect(isSelectableRecord({ id: 'participant', client_deleted_at: '2026-09-26' })).toBe(false);
  });
  it('reads all pages using the fixed API resource rather than following arbitrary next URLs', async () => {
    vi.mocked(request)
      .mockResolvedValueOnce({ results: [{ id: 'first' }], next: 'https://untrusted.invalid/page' })
      .mockResolvedValueOnce({ results: [{ id: 'second' }], next: null });
    expect(await listInsuranceData('vehicles', { deal: 'deal' })).toEqual([
      { id: 'first' },
      { id: 'second' },
    ]);
    expect(request).toHaveBeenLastCalledWith(
      '/insurance-data/vehicles/?deal=deal&page=2&page_size=100',
      { signal: undefined },
    );
  });
  it('normalizes year-only experience without overwriting a precise date', () => {
    expect(normalizeExperienceDate('1986')).toBe('1986-12-31');
    expect(normalizeExperienceDate('1986-02-20')).toBe('1986-02-20');
  });
  it('accepts zero and decimal rubles and rejects negative or invalid amounts', () => {
    expect(parseDeductibles('0; 1000,50')).toEqual(['0.00', '1000.50']);
    expect(() => parseDeductibles('-1')).toThrow();
    expect(() => parseDeductibles('0; infinity')).toThrow();
  });
});
