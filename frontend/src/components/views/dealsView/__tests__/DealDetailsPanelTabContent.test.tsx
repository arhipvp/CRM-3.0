import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DealDetailsPanelTabContent } from '../DealDetailsPanelTabContent';

describe('DealDetailsPanelTabContent', () => {
  it('renders events tab as timeline only without create event action', () => {
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
          onUpdateManualEvent: vi.fn().mockResolvedValue(undefined),
          onDeleteManualEvent: vi.fn().mockResolvedValue(undefined),
        }}
      />,
    );

    expect(screen.getByText('Лента')).toBeInTheDocument();
    expect(screen.getByText('Пока нет событий по сделке.')).toBeInTheDocument();
    expect(screen.queryByText('Добавить событие')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Дата')).not.toBeInTheDocument();
  });
});
