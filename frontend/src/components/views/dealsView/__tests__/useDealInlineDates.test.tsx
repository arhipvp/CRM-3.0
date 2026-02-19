import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useDealInlineDates } from '../hooks/useDealInlineDates';
import type { Deal } from '../../../../types';

const createDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'deal-1',
  title: 'Deal 1',
  clientId: 'client-1',
  clientName: 'Client Name',
  status: 'open',
  createdAt: '2025-01-01T00:00:00Z',
  nextContactDate: '2025-01-01',
  expectedClose: '2025-02-01',
  quotes: [],
  documents: [],
  ...overrides,
});

const renderInlineDatesHook = ({
  selectedDeal,
  sortedDeals,
  onUpdateDeal,
  onSelectDeal,
  onPostponeDeal,
}: Parameters<typeof useDealInlineDates>[0]) => {
  const resultRef: { current: ReturnType<typeof useDealInlineDates> | null } = {
    current: null,
  };

  const Wrapper: React.FC = () => {
    const state = useDealInlineDates({
      selectedDeal,
      sortedDeals,
      onUpdateDeal,
      onSelectDeal,
      onPostponeDeal,
    });
    useEffect(() => {
      resultRef.current = state;
    }, [state]);
    return null;
  };

  render(<Wrapper />);
  return resultRef;
};

describe('useDealInlineDates', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('saves next contact date and exposes updated value', async () => {
    const deal = createDeal();
    const onUpdateDeal = vi.fn().mockResolvedValue(undefined);
    const onSelectDeal = vi.fn();
    const resultRef = renderInlineDatesHook({
      selectedDeal: deal,
      sortedDeals: [deal],
      onUpdateDeal,
      onSelectDeal,
    });

    await act(async () => {
      await resultRef.current?.handleNextContactBlur('2025-01-10');
    });

    await waitFor(() => {
      expect(onUpdateDeal).toHaveBeenCalledWith(
        deal.id,
        expect.objectContaining({ nextContactDate: '2025-01-10' }),
      );
    });
    expect(resultRef.current?.nextContactInputValue).toBe('2025-01-10');
  });

  it('shifts next contact and selects top deal when needed', async () => {
    const deal = createDeal();
    const topDeal = createDeal({ id: 'deal-2' });
    const onUpdateDeal = vi.fn().mockResolvedValue(undefined);
    const onSelectDeal = vi.fn();
    const resultRef = renderInlineDatesHook({
      selectedDeal: deal,
      sortedDeals: [topDeal, deal],
      onUpdateDeal,
      onSelectDeal,
    });

    await act(async () => {
      await resultRef.current?.quickInlineShift(2);
    });

    let expectedNextContactDate: string | undefined;

    await waitFor(() => {
      expectedNextContactDate = resultRef.current?.nextContactInputValue;
      expect(expectedNextContactDate).toBeTruthy();
      expect(onUpdateDeal).toHaveBeenCalledWith(
        deal.id,
        expect.objectContaining({ nextContactDate: expectedNextContactDate }),
      );
      expect(onSelectDeal).toHaveBeenCalledWith(topDeal.id);
    });
    expect(expectedNextContactDate).toBeDefined();
    expect(resultRef.current?.nextContactInputValue).toBe(expectedNextContactDate);
  });

  it('uses unified postpone flow for quick and modal updates', async () => {
    const deal = createDeal();
    const onUpdateDeal = vi.fn().mockResolvedValue(undefined);
    const onSelectDeal = vi.fn();
    const onPostponeDeal = vi.fn().mockResolvedValue(undefined);
    const resultRef = renderInlineDatesHook({
      selectedDeal: deal,
      sortedDeals: [deal],
      onUpdateDeal,
      onSelectDeal,
      onPostponeDeal,
    });

    await act(async () => {
      await resultRef.current?.quickInlinePostponeShift(2);
    });

    await waitFor(() => {
      expect(onPostponeDeal).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await resultRef.current?.postponeDealDates({
        nextContactDate: '2025-01-12',
        expectedClose: '2025-01-20',
      });
    });

    await waitFor(() => {
      expect(onPostponeDeal).toHaveBeenCalledWith(
        deal.id,
        expect.objectContaining({
          nextContactDate: '2025-01-12',
          expectedClose: '2025-01-20',
        }),
      );
    });
    expect(onUpdateDeal).not.toHaveBeenCalled();
  });
});
