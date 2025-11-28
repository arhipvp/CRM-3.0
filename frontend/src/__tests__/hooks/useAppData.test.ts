import { describe, expect, it } from 'vitest';

import { buildDealsCacheKey } from '../../hooks/useAppData';
import type { FilterParams } from '../../api';

describe('buildDealsCacheKey', () => {
  it('is stable across entry ordering', () => {
    const base: FilterParams = {
      ordering: 'next_contact_date',
      search: 'example',
    };
    const swapped: FilterParams = {
      search: 'example',
      ordering: 'next_contact_date',
    };
    expect(buildDealsCacheKey(base)).toBe(buildDealsCacheKey(swapped));
  });

  it('ignores undefined values when building the key', () => {
    const filtered: FilterParams = {
      ordering: 'next_contact_date',
      search: undefined,
      show_deleted: false,
    };
    const explicitlySet: FilterParams = {
      ordering: 'next_contact_date',
      show_deleted: false,
    };
    expect(buildDealsCacheKey(filtered)).toBe(buildDealsCacheKey(explicitlySet));
  });
});
