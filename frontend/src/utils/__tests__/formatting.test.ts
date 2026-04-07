import { describe, expect, it } from 'vitest';

import { formatCurrencyRu } from '../formatting';

describe('formatCurrencyRu', () => {
  it('formats ruble amounts with spaces between groups and a ruble sign', () => {
    expect(formatCurrencyRu(0)).toBe('0,00 ₽');
    expect(formatCurrencyRu(1000)).toBe('1 000,00 ₽');
    expect(formatCurrencyRu(1234567.89)).toBe('1 234 567,89 ₽');
  });

  it('returns fallback for empty and invalid values', () => {
    expect(formatCurrencyRu(null)).toBe('—');
    expect(formatCurrencyRu(undefined)).toBe('—');
    expect(formatCurrencyRu('not-a-number')).toBe('—');
    expect(formatCurrencyRu('not-a-number', '-')).toBe('-');
  });
});
