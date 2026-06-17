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

    expect(screen.queryByLabelText('Дата')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Добавить событие'));

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

    expect(screen.queryByLabelText('Причина')).not.toBeInTheDocument();
    expect(screen.getByText('Добавить событие')).toBeInTheDocument();
  });

  it('collapses manual event form and clears validation error on cancel', () => {
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
          onCreateManualEvent: vi.fn().mockResolvedValue(undefined),
          onUpdateManualEvent: vi.fn().mockResolvedValue(undefined),
          onDeleteManualEvent: vi.fn().mockResolvedValue(undefined),
        }}
      />,
    );

    fireEvent.click(screen.getByText('Добавить событие'));
    fireEvent.change(screen.getByLabelText('Причина'), {
      target: { value: '' },
    });
    fireEvent.click(screen.getByText('Добавить'));

    expect(screen.getByText('Укажите дату и причину события.')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Отмена'));

    expect(screen.queryByLabelText('Дата')).not.toBeInTheDocument();
    expect(screen.queryByText('Укажите дату и причину события.')).not.toBeInTheDocument();
  });
});
