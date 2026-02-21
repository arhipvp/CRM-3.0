import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useDealMerge } from '../hooks/useDealMerge';
import type { Deal, User } from '../../../../types';

vi.mock('../../../../api', () => ({
  fetchDeals: vi.fn(),
  previewDealMerge: vi.fn(),
}));

import { fetchDeals, previewDealMerge } from '../../../../api';

const fetchDealsMock = vi.mocked(fetchDeals);
const previewDealMergeMock = vi.mocked(previewDealMerge);

const createDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'deal-1',
  title: 'Deal 1',
  clientId: 'client-1',
  clientName: 'Client A',
  status: 'open',
  createdAt: '2025-01-01T00:00:00Z',
  quotes: [],
  documents: [],
  ...overrides,
});

const createUser = (overrides: Partial<User> = {}): User => ({
  id: 'user-1',
  username: 'user',
  roles: [],
  ...overrides,
});

type DealMergeHookParams = Parameters<typeof useDealMerge>[0];

const renderDealMergeHook = (params: DealMergeHookParams) => {
  const resultRef: { current: ReturnType<typeof useDealMerge> | null } = {
    current: null,
  };

  const Wrapper: React.FC<DealMergeHookParams> = (props) => {
    const state = useDealMerge(props);
    useEffect(() => {
      resultRef.current = state;
    }, [state]);
    return null;
  };

  render(<Wrapper {...params} />);
  return resultRef;
};

describe('useDealMerge', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('searches deals after a debounce and includes seller filter', async () => {
    const selectedDeal = createDeal();
    const otherDeal = createDeal({ id: 'deal-2' });
    const onMergeDeals = vi.fn().mockResolvedValue(undefined);

    const resultRef = renderDealMergeHook({
      deals: [selectedDeal, otherDeal],
      selectedDeal,
      currentUser: createUser({ id: 'user-123' }),
      onMergeDeals,
      debounceDelay: 0,
    });

    fetchDealsMock.mockResolvedValueOnce([otherDeal]);

    act(() => {
      resultRef.current?.setMergeSearch('foo');
    });

    await waitFor(() => {
      expect(fetchDealsMock).toHaveBeenCalledWith(
        expect.objectContaining({
          search: 'foo',
          page_size: 50,
          seller: 'user-123',
        }),
      );
    });
  });

  it('toggles sources and submits merge request', async () => {
    const selectedDeal = createDeal();
    const otherDeal = createDeal({ id: 'deal-2' });
    const onMergeDeals = vi.fn().mockResolvedValue(undefined);

    const resultRef = renderDealMergeHook({
      deals: [selectedDeal, otherDeal],
      selectedDeal,
      currentUser: null,
      onMergeDeals,
      debounceDelay: 0,
    });

    act(() => {
      resultRef.current?.toggleMergeSource(otherDeal.id);
      resultRef.current?.openMergeModal();
    });

    previewDealMergeMock.mockResolvedValueOnce({
      targetDealId: selectedDeal.id,
      sourceDealIds: [otherDeal.id],
      includeDeleted: true,
      movedCounts: { tasks: 1 },
      items: {},
      drivePlan: [],
      warnings: [],
      finalDealDraft: {
        title: selectedDeal.title,
        clientId: selectedDeal.clientId,
        description: '',
      },
    });

    await act(async () => {
      await resultRef.current?.requestMergePreview();
    });

    await act(async () => {
      await resultRef.current?.handleMergeSubmit({
        title: 'Merged',
        clientId: selectedDeal.clientId,
        description: '',
      });
    });

    await waitFor(() =>
      expect(onMergeDeals).toHaveBeenCalledWith(
        selectedDeal.id,
        [otherDeal.id],
        expect.objectContaining({
          title: 'Merged',
          clientId: selectedDeal.clientId,
        }),
        expect.stringContaining('deal-merge-preview:'),
      ),
    );
    expect(resultRef.current?.isMergeModalOpen).toBe(false);
  });
});
