import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Deal } from '../../../../../types';
import type { DealEvent } from '../../eventUtils';
import { useDealDetailsPanelActions } from '../useDealDetailsPanelActions';

const selectedDeal: Deal = {
  id: 'deal-1',
  title: 'Инфинити',
  clientId: 'client-1',
  clientName: 'Client A',
  status: 'open',
  createdAt: '2024-01-01T00:00:00Z',
  quotes: [],
  documents: [],
};

const selectedDelayEvent: DealEvent = {
  id: 'payment-1',
  type: 'payment',
  date: '2026-10-24',
  title: 'Очередной платёж',
  description: 'по полису AI524281220 · Сумма 42 425,50 ₽',
};

describe('useDealDetailsPanelActions', () => {
  it('confirms delay without date-to-event validation and keeps schedule payload', async () => {
    const onScheduleDelay = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useDealDetailsPanelActions({
        selectedDeal,
        relatedTasks: [],
        dealEvents: [selectedDelayEvent],
        nextDelayEventId: selectedDelayEvent.id,
        selectedDelayEvent,
        selectedDelayEventNextContact: '2026-08-25',
        isSelectedDealDeleted: false,
        isDealClosedStatus: false,
        isCurrentUserSeller: true,
        canReopenClosedDeal: false,
        onDeleteDeal: vi.fn().mockResolvedValue(undefined),
        onRestoreDeal: vi.fn().mockResolvedValue(undefined),
        onCloseDeal: vi.fn().mockResolvedValue(undefined),
        onReopenDeal: vi.fn().mockResolvedValue(undefined),
        onUpdateTask: vi.fn().mockResolvedValue(undefined),
        onCreateDealMailbox: vi.fn().mockResolvedValue({ deal: {} }),
        onCheckDealMailbox: vi.fn().mockResolvedValue({
          mailboxSync: { processed: 0, skipped: 0, failed: 0, deleted: 0 },
        }),
        onRefreshDeal: vi.fn().mockResolvedValue(undefined),
        onRefreshPolicies: vi.fn().mockResolvedValue(undefined),
        onScheduleDelay,
        onLoadChatMessages: vi.fn().mockResolvedValue(undefined),
        onLoadActivityLogs: vi.fn().mockResolvedValue(undefined),
        onReloadNotes: vi.fn().mockResolvedValue(undefined),
        onLoadDriveFiles: vi.fn().mockResolvedValue(undefined),
        openMergeModal: vi.fn(),
        openSimilarModal: vi.fn(),
      }),
    );

    await act(async () => {
      result.current.setDelayNextContactInput('2026-08-25');
    });

    await act(async () => {
      await result.current.handleDelayModalConfirm();
    });

    expect(result.current.delayValidationError).toBeNull();
    expect(onScheduleDelay).toHaveBeenCalledWith({
      nextContactDate: '2026-08-25',
      expectedClose: '2026-10-24',
    });
  });

  it('passes trimmed completion comment when marking task done', async () => {
    const onUpdateTask = vi.fn().mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useDealDetailsPanelActions({
        selectedDeal,
        relatedTasks: [],
        dealEvents: [],
        nextDelayEventId: null,
        selectedDelayEvent: null,
        selectedDelayEventNextContact: null,
        isSelectedDealDeleted: false,
        isDealClosedStatus: false,
        isCurrentUserSeller: true,
        canReopenClosedDeal: false,
        onDeleteDeal: vi.fn().mockResolvedValue(undefined),
        onRestoreDeal: vi.fn().mockResolvedValue(undefined),
        onCloseDeal: vi.fn().mockResolvedValue(undefined),
        onReopenDeal: vi.fn().mockResolvedValue(undefined),
        onUpdateTask,
        onCreateDealMailbox: vi.fn().mockResolvedValue({ deal: {} }),
        onCheckDealMailbox: vi.fn().mockResolvedValue({
          mailboxSync: { processed: 0, skipped: 0, failed: 0, deleted: 0 },
        }),
        onRefreshDeal: vi.fn().mockResolvedValue(undefined),
        onRefreshPolicies: vi.fn().mockResolvedValue(undefined),
        onScheduleDelay: vi.fn().mockResolvedValue(undefined),
        onLoadChatMessages: vi.fn().mockResolvedValue(undefined),
        onLoadActivityLogs: vi.fn().mockResolvedValue(undefined),
        onReloadNotes: vi.fn().mockResolvedValue(undefined),
        onLoadDriveFiles: vi.fn().mockResolvedValue(undefined),
        openMergeModal: vi.fn(),
        openSimilarModal: vi.fn(),
      }),
    );

    await act(async () => {
      await result.current.handleMarkTaskDone('task-1', '  Готово  ');
    });

    expect(onUpdateTask).toHaveBeenCalledWith('task-1', {
      status: 'done',
      completionComment: 'Готово',
    });
  });
});
