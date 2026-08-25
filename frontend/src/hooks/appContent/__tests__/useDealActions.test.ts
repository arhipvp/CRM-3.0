import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useDealActions } from '../useDealActions';
import type { Deal } from '../../../types';

vi.mock('../../../api', () => {
  class APIError extends Error {
    status: number;

    constructor(message: string, status = 500) {
      super(message);
      this.status = status;
    }
  }

  return {
    APIError,
    checkDealMailbox: vi.fn(),
    closeDeal: vi.fn(),
    createChatMessage: vi.fn(),
    createDeal: vi.fn(),
    createDealMailbox: vi.fn(),
    createQuote: vi.fn(),
    createTask: vi.fn(),
    deleteChatMessage: vi.fn(),
    deleteDeal: vi.fn(),
    deleteQuote: vi.fn(),
    deleteTask: vi.fn(),
    fetchChatMessages: vi.fn(),
    mergeDeals: vi.fn(),
    pinDeal: vi.fn(),
    reopenDeal: vi.fn(),
    restoreDeal: vi.fn(),
    unpinDeal: vi.fn(),
    updateDeal: vi.fn(),
    updateQuote: vi.fn(),
    updateTask: vi.fn(),
  };
});

import {
  closeDeal,
  createDeal as createDealRequest,
  mergeDeals,
  pinDeal,
  updateDeal,
} from '../../../api';

const closeDealMock = vi.mocked(closeDeal);
const createDealRequestMock = vi.mocked(createDealRequest);
const mergeDealsMock = vi.mocked(mergeDeals);
const pinDealMock = vi.mocked(pinDeal);
const updateDealMock = vi.mocked(updateDeal);

const createDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'deal-1',
  title: 'Deal 1',
  clientId: 'client-1',
  clientName: 'Client',
  status: 'open',
  createdAt: '2025-01-01T00:00:00Z',
  quotes: [],
  documents: [],
  ...overrides,
});

const createParams = () => {
  const updateAppData = vi.fn((updater) =>
    updater({
      deals: [createDeal()],
      policies: [],
      payments: [],
      tasks: [],
    }),
  );

  return {
    deals: [createDeal()],
    dealsById: new Map<string, Deal>(),
    selectedDeal: createDeal(),
    selectedDealId: 'deal-1',
    isDealFocusCleared: false,
    isDealsRoute: true,
    dealFilters: {},
    editingQuote: null,
    setEditingQuote: vi.fn(),
    setQuoteDealId: vi.fn(),
    setModal: vi.fn(),
    confirm: vi.fn(),
    addNotification: vi.fn(),
    setError: vi.fn(),
    setIsSyncing: vi.fn(),
    updateAppData,
    prependTransientDeal: vi.fn(),
    invalidateDealsCache: vi.fn(),
    refreshDeals: vi.fn(),
    refreshDealsWithSelection: vi.fn(),
    selectDealById: vi.fn(),
    clearSelectedDealFocus: vi.fn(),
    resetDealSelection: vi.fn(),
    requestDealRowFocus: vi.fn(),
    resetDealFilters: vi.fn(),
    invalidateDealQuotesCache: vi.fn(),
    invalidateDealTasksCache: vi.fn(),
    cacheDealQuotes: vi.fn(),
    openDealPreview: vi.fn(),
  };
};

describe('useDealActions', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('показывает warning-уведомление после успешного merge с предупреждениями', async () => {
    const params = createParams();
    mergeDealsMock.mockResolvedValue({
      resultDeal: createDeal({ id: 'merged-deal', title: 'Merged Deal' }),
      mergedDealIds: ['deal-1', 'deal-2'],
      movedCounts: {},
      warnings: ['Файлы перенесены, но старая папка Drive не удалена.'],
      details: {},
    });

    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handleMergeDeals(
        'deal-1',
        ['deal-2'],
        {
          title: 'Merged Deal',
          clientId: 'client-1',
          description: '',
        },
        'preview-1',
      );
    });

    expect(params.addNotification).toHaveBeenCalledWith('Сделки объединены', 'success', 4000);
    expect(params.addNotification).toHaveBeenCalledWith(
      'Файлы перенесены, но старая папка Drive не удалена.',
      'warning',
      7000,
    );
  });

  it('не показывает warning-уведомление при merge без предупреждений', async () => {
    const params = createParams();
    mergeDealsMock.mockResolvedValue({
      resultDeal: createDeal({ id: 'merged-deal', title: 'Merged Deal' }),
      mergedDealIds: ['deal-1', 'deal-2'],
      movedCounts: {},
      warnings: [],
      details: {},
    });

    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handleMergeDeals('deal-1', ['deal-2'], {
        title: 'Merged Deal',
        clientId: 'client-1',
        description: '',
      });
    });

    expect(params.addNotification).toHaveBeenCalledTimes(1);
    expect(params.addNotification).toHaveBeenCalledWith('Сделки объединены', 'success', 4000);
  });

  it('сохраняет загруженный объем списка при переносе сделки', async () => {
    const params = createParams();
    updateDealMock.mockResolvedValue(createDeal());
    params.refreshDeals.mockResolvedValue([createDeal()]);

    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handlePostponeDeal('deal-1', {
        title: 'Deal 1',
        clientId: 'client-1',
        description: '',
        nextContactDate: '2026-02-01',
      });
    });

    expect(params.refreshDeals).toHaveBeenCalledWith(params.dealFilters, {
      force: true,
      preserveLoadedCount: true,
    });
  });

  it('после закрепления выбранной сделки обновляет список и возвращает фокус строке', async () => {
    const params = createParams();
    params.refreshDealsWithSelection.mockResolvedValue([createDeal()]);
    pinDealMock.mockResolvedValue(createDeal({ isPinned: true }));
    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handlePinDeal('deal-1');
    });

    expect(params.refreshDealsWithSelection).toHaveBeenCalledWith(params.dealFilters, {
      force: true,
    });
    expect(params.requestDealRowFocus).toHaveBeenCalledWith('deal-1');
  });

  it('не меняет фокус при закреплении другой сделки', async () => {
    const params = createParams();
    params.refreshDealsWithSelection.mockResolvedValue([createDeal({ id: 'deal-2' })]);
    pinDealMock.mockResolvedValue(createDeal({ id: 'deal-2', isPinned: true }));
    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handlePinDeal('deal-2');
    });

    expect(params.requestDealRowFocus).not.toHaveBeenCalled();
  });

  it('после создания сохраняет фильтры, добавляет отсутствующую в выдаче сделку и фокусирует её', async () => {
    const params = createParams();
    params.dealFilters = { client: 'client-2', executor: 'user-2', search: 'ипотека' };
    const created = createDeal({ id: 'deal-new' });
    createDealRequestMock.mockResolvedValue(created);
    params.refreshDealsWithSelection.mockResolvedValue([createDeal({ id: 'deal-2' })]);
    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handleAddDeal({
        title: 'Новая сделка',
        clientId: 'client-1',
        description: '',
      });
    });

    expect(params.resetDealFilters).not.toHaveBeenCalled();
    expect(params.refreshDealsWithSelection).toHaveBeenCalledWith(params.dealFilters, {
      force: true,
    });
    expect(params.prependTransientDeal).toHaveBeenCalledWith(created);
    expect(params.selectDealById).toHaveBeenCalledWith(created.id);
    expect(params.requestDealRowFocus).toHaveBeenCalledWith(created.id);
  });

  it('не добавляет дубликат новой сделки, если она уже попала в отфильтрованную выдачу', async () => {
    const params = createParams();
    params.dealFilters = { search: 'сделка' };
    const created = createDeal({ id: 'deal-new' });
    createDealRequestMock.mockResolvedValue(created);
    params.refreshDealsWithSelection.mockResolvedValue([created]);
    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handleAddDeal({
        title: 'Новая сделка',
        clientId: 'client-1',
        description: '',
      });
    });

    expect(params.prependTransientDeal).not.toHaveBeenCalled();
    expect(params.selectDealById).toHaveBeenCalledWith(created.id);
  });

  it('сразу скрывает закрытую сделку, снимает фокус и обновляет выдачу в фоне', async () => {
    const params = createParams();
    params.dealFilters = { search: 'сделка' };
    const closedDeal = createDeal({ status: 'won' });
    closeDealMock.mockResolvedValue(closedDeal);
    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handleCloseDeal('deal-1', { reason: 'Успех', status: 'won' });
    });

    expect(params.refreshDealsWithSelection).toHaveBeenCalledWith(params.dealFilters, {
      force: true,
    });
    expect(params.updateAppData).toHaveBeenCalledTimes(1);
    expect(params.updateAppData.mock.results[0].value).toEqual({ deals: [] });
    expect(params.clearSelectedDealFocus).toHaveBeenCalledWith('deal-1');
  });

  it('оставляет закрытую сделку в ленте закрытых и обновляет её локально', async () => {
    const params = createParams();
    params.dealFilters = { show_closed: true };
    const closedDeal = createDeal({ status: 'lost', closingReason: 'Не договорились' });
    closeDealMock.mockResolvedValue(closedDeal);
    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handleCloseDeal('deal-1', { reason: 'Не договорились', status: 'lost' });
    });

    expect(params.updateAppData.mock.results[0].value).toEqual({ deals: [closedDeal] });
    expect(params.clearSelectedDealFocus).not.toHaveBeenCalled();
  });

  it('не возвращает закрытую сделку при ошибке фонового обновления', async () => {
    const params = createParams();
    const refreshError = new Error('Сеть недоступна');
    closeDealMock.mockResolvedValue(createDeal({ status: 'won' }));
    params.refreshDealsWithSelection.mockRejectedValue(refreshError);
    const { result } = renderHook(() => useDealActions(params));

    await act(async () => {
      await result.current.handleCloseDeal('deal-1', { reason: 'Успех', status: 'won' });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(params.updateAppData.mock.results[0].value).toEqual({ deals: [] });
    expect(params.clearSelectedDealFocus).toHaveBeenCalledWith('deal-1');
    expect(params.setError).not.toHaveBeenCalled();
  });
});
