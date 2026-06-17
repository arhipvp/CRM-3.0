import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DealDetailsPanelTabContent } from '../DealDetailsPanelTabContent';

describe('DealDetailsPanelTabContent', () => {
  it('creates manual event from events tab form', async () => {
    const onCreateManualEvent = vi.fn().mockResolvedValue(undefined);

    render(
      <DealDetailsPanelTabContent
        activeTab="events"
        notesSectionProps={{} as never}
        tasksTabProps={{} as never}
        policiesTabProps={{} as never}
        quotesTabProps={{} as never}
        filesTabProps={{} as never}
        chatTabProps={{} as never}
        activityProps={{
          activityError: null,
          activityLogs: [],
          isActivityLoading: false,
          dealEventsError: null,
          dealTimelineEvents: [],
          isDealEventsLoading: false,
          onCreateManualEvent,
          onUpdateManualEvent: vi.fn().mockResolvedValue(undefined),
          onDeleteManualEvent: vi.fn().mockResolvedValue(undefined),
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText('Дата'), {
      target: { value: '2027-06-16' },
    });
    fireEvent.change(screen.getByLabelText('Причина'), {
      target: {
        value: 'Предположительно купит квартиру, предложить застраховать',
      },
    });
    fireEvent.click(screen.getByText('Добавить'));

    await waitFor(() => {
      expect(onCreateManualEvent).toHaveBeenCalledWith({
        eventDate: '2027-06-16',
        reason: 'Предположительно купит квартиру, предложить застраховать',
      });
    });

    expect(screen.getByLabelText('Причина')).toHaveValue('');
  });
});
