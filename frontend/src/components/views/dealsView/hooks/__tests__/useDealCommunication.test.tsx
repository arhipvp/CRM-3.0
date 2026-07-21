import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDealCommunication } from '../useDealCommunication';

const createArgs = (dealEventsRefreshToken = 0) => ({
  selectedDealId: 'deal-1',
  selectedDealDeletedAt: null,
  activeTab: 'events' as const,
  onFetchChatMessages: vi.fn().mockResolvedValue([]),
  onSendChatMessage: vi.fn(),
  onDeleteChatMessage: vi.fn(),
  onFetchDealHistory: vi.fn().mockResolvedValue([]),
  onFetchDealEvents: vi.fn().mockResolvedValue([]),
  dealEventsRefreshToken,
});

describe('useDealCommunication', () => {
  it('cancels an outdated chat request and ignores its response after deal changes', async () => {
    let resolveFirstRequest!: (messages: never[]) => void;
    const firstRequest = new Promise<never[]>((resolve) => {
      resolveFirstRequest = resolve;
    });
    const onFetchChatMessages = vi.fn().mockReturnValueOnce(firstRequest).mockResolvedValueOnce([]);
    const args = createArgs();
    const { result, rerender } = renderHook(
      ({ dealId }: { dealId: string }) =>
        useDealCommunication({
          ...args,
          activeTab: 'chat',
          selectedDealId: dealId,
          onFetchChatMessages,
        }),
      { initialProps: { dealId: 'deal-1' } },
    );

    await waitFor(() => expect(onFetchChatMessages).toHaveBeenCalledTimes(1));
    const firstSignal = onFetchChatMessages.mock.calls[0]?.[1]?.signal;

    rerender({ dealId: 'deal-2' });

    await waitFor(() => expect(onFetchChatMessages).toHaveBeenCalledTimes(2));
    expect(firstSignal?.aborted).toBe(true);

    await act(async () => {
      resolveFirstRequest([
        { id: 'stale-message', body: 'stale', createdAt: '2026-01-01T00:00:00Z' } as never,
      ]);
      await Promise.resolve();
    });
    expect(result.current.chatMessages).toEqual([]);
  });

  it('reloads deal events when external refresh token changes', async () => {
    const args = createArgs();
    const { rerender } = renderHook(
      ({ token }: { token: number }) =>
        useDealCommunication({
          ...args,
          dealEventsRefreshToken: token,
        }),
      { initialProps: { token: 0 } },
    );

    await waitFor(() => {
      expect(args.onFetchDealEvents).toHaveBeenCalledTimes(1);
    });

    rerender({ token: 1 });

    await waitFor(() => {
      expect(args.onFetchDealEvents).toHaveBeenCalledTimes(2);
    });
    expect(args.onFetchDealEvents).toHaveBeenLastCalledWith(
      'deal-1',
      false,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
});
