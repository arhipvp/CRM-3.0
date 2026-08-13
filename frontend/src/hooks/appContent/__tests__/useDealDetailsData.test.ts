import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Deal } from '../../../types';
import { useDealDetailsData } from '../useDealDetailsData';

type Params = Parameters<typeof useDealDetailsData>[0];

const createDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'deal-1',
  title: 'Открытая сделка',
  clientId: 'client-1',
  clientName: 'Клиент',
  status: 'open',
  createdAt: '2026-08-13T00:00:00Z',
  quotes: [],
  documents: [],
  ...overrides,
});

const createParams = (overrides: Partial<Params> = {}): Params => {
  const selectedDeal = createDeal();
  return {
    deals: [selectedDeal],
    deepLinkedDealId: null,
    isAuthenticated: false,
    isDealsRoute: true,
    effectiveSelectedDealId: selectedDeal.id,
    previewDealId: null,
    isDealSelectionBlocked: false,
    dealFilters: {},
    refreshDeals: vi.fn().mockResolvedValue([]) as Params['refreshDeals'],
    invalidateDealsCache: vi.fn(),
    updateAppData: vi.fn() as Params['updateAppData'],
    setError: vi.fn(),
    clearSelectedDealFocus: vi.fn(),
    selectDealById: vi.fn(),
    openDealPreviewById: vi.fn(),
    setIsRefreshingDealsList: vi.fn(),
    ...overrides,
  };
};

describe('useDealDetailsData search selection', () => {
  it('clears a missing deep-linked deal instead of adding it to search results', async () => {
    const params = createParams({
      deepLinkedDealId: 'deal-1',
      dealFilters: { search: 'другая сделка' },
    });
    const { result } = renderHook(() => useDealDetailsData(params));

    await act(async () => {
      await result.current.refreshDealsWithSelection(params.dealFilters);
    });

    expect(params.clearSelectedDealFocus).toHaveBeenCalledTimes(1);
    expect(params.updateAppData).toHaveBeenCalledTimes(1);
  });

  it('clears a missing protected created deal during search', async () => {
    const params = createParams({ dealFilters: { search: 'другая сделка' } });
    const { result } = renderHook(() => useDealDetailsData(params));

    act(() => {
      result.current.registerProtectedCreatedDeal(params.deals[0]);
    });
    await act(async () => {
      await result.current.refreshDealsWithSelection(params.dealFilters);
    });

    expect(params.clearSelectedDealFocus).toHaveBeenCalledTimes(1);
    expect(params.updateAppData).toHaveBeenCalledTimes(1);
  });

  it('keeps focus when the selected deal matches the search', async () => {
    const selectedDeal = createDeal();
    const params = createParams({
      deals: [selectedDeal],
      dealFilters: { search: 'открытая' },
      refreshDeals: vi.fn().mockResolvedValue([selectedDeal]) as Params['refreshDeals'],
    });
    const { result } = renderHook(() => useDealDetailsData(params));

    await act(async () => {
      await result.current.refreshDealsWithSelection(params.dealFilters);
    });

    expect(params.clearSelectedDealFocus).not.toHaveBeenCalled();
    expect(params.updateAppData).toHaveBeenCalledTimes(1);
  });

  it('preserves a missing deep-linked deal when search is not active', async () => {
    const params = createParams({ deepLinkedDealId: 'deal-1' });
    const { result } = renderHook(() => useDealDetailsData(params));

    await act(async () => {
      await result.current.refreshDealsWithSelection(params.dealFilters);
    });

    expect(params.clearSelectedDealFocus).not.toHaveBeenCalled();
    expect(params.updateAppData).toHaveBeenCalledTimes(2);
  });
});
