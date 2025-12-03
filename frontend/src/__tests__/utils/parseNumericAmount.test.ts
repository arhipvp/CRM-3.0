import { describe, expect, it } from 'vitest';
import { parseNumericAmount } from '../../utils/parseNumericAmount';

describe('parseNumericAmount', () => {
  it('returns NaN for empty or undefined input', () => {
    expect(parseNumericAmount()).toBeNaN();
    expect(parseNumericAmount(null)).toBeNaN();
    expect(parseNumericAmount('')).toBeNaN();
  });

  it('parses integers and decimals with dots', () => {
    expect(parseNumericAmount('123')).toBe(123);
    expect(parseNumericAmount(' 456.78 ')).toBe(456.78);
  });

  it('supports comma decimals and spaces inside', () => {
    expect(parseNumericAmount('1 234,56')).toBe(1234.56);
    expect(parseNumericAmount('7,89')).toBe(7.89);
  });

  it('returns NaN for invalid strings', () => {
    expect(parseNumericAmount('abc')).toBeNaN();
    expect(parseNumericAmount('1,2.3')).toBeNaN();
  });
});
