import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchDealsWithPagination } from '../../../../api/deals';
import type { Deal } from '../../../../types';
import { useCommandPalette } from '../useCommandPalette';

vi.mock('../../../../api/deals', () => ({ fetchDealsWithPagination: vi.fn() }));

const mockedFetchDeals = vi.mocked(fetchDealsWithPagination);

const createDeal = (id: string, title: string) =>
  ({ id, title, clientName: 'Клиент', createdAt: '2026-01-01' }) as unknown as Deal;

describe('useCommandPalette task deal lookup', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it('debounces server search and keeps recently loaded deals as fallback', async () => {
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
      useCommandPalette({
        deals: [createDeal('recent', 'Недавняя сделка')],
        selectedDeal: null,
        selectedClientShortcut: null,
        selectedPolicyShortcut: null,
        selectedTaskShortcut: null,
        isDealsRoute: false,
        isClientsRoute: false,
        isPoliciesRoute: false,
        isTasksRoute: false,
        selectedDealId: null,
        selectedDealExists: false,
        navigate: vi.fn(),
        selectDealById,
        setQuickTaskDealId,
        openDealCreateModal: vi.fn(),
        openClientCreateModal: vi.fn(),
        openSelectedDealPreview: vi.fn(),
        deleteSelectedDeal: vi.fn(),
        restoreSelectedDeal: vi.fn(),
        openSelectedClient: vi.fn(),
        deleteSelectedClient: vi.fn(),
        openSelectedPolicy: vi.fn(),
        openSelectedTaskDealPreview: vi.fn(),
        markSelectedTaskDone: vi.fn(),
      }),
    );

    act(() => {
      result.current.openTaskCreateFlow();
      result.current.setTaskDealQuery('удалённая');
    });
    expect(result.current.taskDealItems.map((item) => item.id)).toContain('task-deal-recent');
    expect(mockedFetchDeals).not.toHaveBeenCalled();

    await act(async () => vi.advanceTimersByTimeAsync(300));
    vi.useRealTimers();
    await waitFor(() => expect(mockedFetchDeals).toHaveBeenCalledTimes(1));
    expect(mockedFetchDeals).toHaveBeenCalledWith(
      { search: 'удалённая', page_size: 20 },
      expect.objectContaining({ embed: 'none' }),
    );
    expect(result.current.taskDealItems.map((item) => item.id)).toEqual([
      'task-deal-remote',
      'task-deal-recent',
    ]);
  });
});
