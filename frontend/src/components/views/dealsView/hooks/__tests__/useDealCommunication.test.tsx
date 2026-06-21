import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDealCommunication } from '../useDealCommunication';

const createArgs = (dealEventsRefreshToken = 0) => ({
  selectedDealId: 'deal-1',
  selectedDealDeletedAt: null,
  activeTab: 'overview' as const,
  onFetchChatMessages: vi.fn().mockResolvedValue([]),
  onSendChatMessage: vi.fn(),
  onDeleteChatMessage: vi.fn(),
  onFetchDealHistory: vi.fn().mockResolvedValue([]),
  onFetchDealEvents: vi.fn().mockResolvedValue([]),
  dealEventsRefreshToken,
});

describe('useDealCommunication', () => {
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
    expect(args.onFetchDealEvents).toHaveBeenLastCalledWith('deal-1', false);
  });
});
