import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useDealFilters } from '../useDealFilters';

describe('useDealFilters', () => {
  it('shows all non-deleted deals for one client without previous list filters', () => {
    const { result } = renderHook(() => useDealFilters());

    act(() => {
      result.current.applyDealSearch('ипотека');
      result.current.setDealExecutorFilter('42');
      result.current.setDealShowDeleted(true);
      result.current.setDealOrdering('-created_at');
    });
    act(() => result.current.showClientDeals('client-1'));

    expect(result.current.dealSearchInput).toBe('');
    expect(result.current.filters).toEqual({ client: 'client-1', show_closed: true });

    act(() => result.current.applyDealSearch('каско'));

    expect(result.current.filters).not.toHaveProperty('client');
  });

  it('resets every filter before showing a newly created deal', () => {
    const { result } = renderHook(() => useDealFilters());

    act(() => {
      result.current.applyDealSearch('ипотека');
      result.current.setDealExecutorFilter('42');
      result.current.setDealShowDeleted(true);
      result.current.setDealShowClosed(true);
      result.current.setDealOrdering('-created_at');
    });
    act(() => result.current.resetDealFilters());

    expect(result.current.dealSearchInput).toBe('');
    expect(result.current.dealExecutorFilter).toBe('');
    expect(result.current.dealShowDeleted).toBe(false);
    expect(result.current.dealShowClosed).toBe(false);
    expect(result.current.dealOrdering).toBeUndefined();
    expect(result.current.filters).toEqual({});
  });
});
