import React, { useEffect } from 'react';
import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDealTimeTracking } from '../hooks/useDealTimeTracking';

const fetchSummaryMock = vi.fn();
const sendTickMock = vi.fn();

vi.mock('../../../../api/deals', () => ({
  fetchDealTimeTrackingSummary: (...args: unknown[]) => fetchSummaryMock(...args),
  sendDealTimeTrackingTick: (...args: unknown[]) => sendTickMock(...args),
}));

const renderHookState = (selectedDealId?: string) => {
  const ref: { current: ReturnType<typeof useDealTimeTracking> | null } = { current: null };

  const Wrapper: React.FC<{ dealId?: string }> = ({ dealId }) => {
    const state = useDealTimeTracking(dealId);
    useEffect(() => {
      ref.current = state;
    }, [state]);
    return null;
  };

  render(<Wrapper dealId={selectedDealId} />);
  return ref;
};

const flushPromises = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

describe('useDealTimeTracking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    fetchSummaryMock.mockResolvedValue({
      enabled: true,
      tickSeconds: 10,
      confirmIntervalSeconds: 180,
      myTotalSeconds: 0,
      myTotalHuman: '00:00:00',
    });
    sendTickMock.mockResolvedValue({
      enabled: true,
      tickSeconds: 10,
      confirmIntervalSeconds: 180,
      counted: true,
      bucketStart: '2026-02-19T00:00:00Z',
      myTotalSeconds: 10,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts ticking and updates total seconds', async () => {
    const ref = renderHookState('deal-1');
    await flushPromises();
    expect(fetchSummaryMock).toHaveBeenCalledWith('deal-1');

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    await flushPromises();
    expect(sendTickMock).toHaveBeenCalledWith('deal-1');
    expect(ref.current?.myTotalSeconds).toBe(10);
  });

  it('opens confirmation modal after 180 seconds and pauses until continue', async () => {
    sendTickMock.mockImplementation(async () => ({
      enabled: true,
      tickSeconds: 10,
      confirmIntervalSeconds: 180,
      counted: true,
      bucketStart: '2026-02-19T00:00:00Z',
      myTotalSeconds: 10,
    }));

    const ref = renderHookState('deal-1');
    await flushPromises();
    expect(fetchSummaryMock).toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(180_000);
    });
    await flushPromises();
    expect(ref.current?.isConfirmModalOpen).toBe(true);
    expect(ref.current?.isPausedForConfirm).toBe(true);

    const callsBeforeContinue = sendTickMock.mock.calls.length;

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    expect(sendTickMock.mock.calls.length).toBe(callsBeforeContinue);

    act(() => {
      ref.current?.continueTracking();
    });
    await flushPromises();
    expect(ref.current?.isConfirmModalOpen).toBe(false);

    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
    expect(sendTickMock.mock.calls.length).toBeGreaterThan(callsBeforeContinue);
  });
});
