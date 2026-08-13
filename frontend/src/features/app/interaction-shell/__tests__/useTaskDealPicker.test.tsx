import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchDealsWithPagination } from '../../../../api/deals';
import type { Deal } from '../../../../types';
import { useTaskDealPicker } from '../useTaskDealPicker';

vi.mock('../../../../api/deals', () => ({ fetchDealsWithPagination: vi.fn() }));

const mockedFetchDeals = vi.mocked(fetchDealsWithPagination);
const createDeal = (id: string, title: string) =>
  ({ id, title, clientName: 'Клиент', createdAt: '2026-01-01' }) as unknown as Deal;

describe('useTaskDealPicker', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('searches remote deals and retains loaded deals as choices', async () => {
    vi.useFakeTimers();
    mockedFetchDeals.mockResolvedValue({
      count: 1,
      next: null,
      previous: null,
      results: [createDeal('remote', 'Удалённая сделка')],
    });
    const setQuickTaskDealId = vi.fn();
    const selectDealById = vi.fn();
    const { result } = renderHook(() =>
      useTaskDealPicker({
        deals: [createDeal('recent', 'Недавняя сделка')],
        selectDealById,
        setQuickTaskDealId,
      }),
    );

    act(() => {
      result.current.open();
      result.current.setQuery('удалённая');
    });
    await act(async () => vi.advanceTimersByTimeAsync(300));
    vi.useRealTimers();

    await waitFor(() => expect(mockedFetchDeals).toHaveBeenCalledTimes(1));
    expect(result.current.items.map((item) => item.id)).toEqual([
      'task-deal-remote',
      'task-deal-recent',
    ]);

    await act(async () => result.current.items[0].onSelect());
    expect(selectDealById).toHaveBeenCalledWith('remote');
    expect(setQuickTaskDealId).toHaveBeenCalledWith('remote');
  });
});
