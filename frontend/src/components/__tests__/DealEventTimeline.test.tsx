import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DealEventTimeline } from '../DealEventTimeline';
import type { DealTimelineEvent } from '../../types';

const manualEvent: DealTimelineEvent = {
  id: 'deal-event-event-1',
  deal: 'deal-1',
  eventType: 'manual',
  eventTypeDisplay: 'Ручное событие',
  eventDate: '2027-06-16',
  title: 'Предположительно купит квартиру, предложить застраховать',
  description: '',
  sourceType: '',
  sourceId: '',
  actor: 'user-1',
  actorUsername: 'seller',
  actorDisplayName: 'Seller',
  metadata: {},
  createdAt: '2026-06-17T10:00:00Z',
};

const policyEvent: DealTimelineEvent = {
  id: 'policy-expiration-policy-1',
  deal: 'deal-1',
  eventType: 'policy_expiration',
  eventTypeDisplay: 'Окончание полиса',
  eventDate: '2027-06-16',
  title: 'Окончание полиса',
  description: 'полис POL-777',
  sourceType: 'policy',
  sourceId: 'policy-1',
  actor: null,
  actorUsername: null,
  actorDisplayName: null,
  metadata: { policy_number: 'POL-777' },
  createdAt: '2026-06-17T10:00:00Z',
};

const manualExpectedCloseEvent: DealTimelineEvent = {
  ...manualEvent,
  id: 'deal-event-expected-close',
  eventType: 'manual_expected_close',
  eventTypeDisplay: 'Дата страхования вручную',
  eventDate: '2027-06-18',
  title: 'Ручной крайний срок выставлен',
  description: 'Дата изменена с — на 2027-06-18.',
  sourceType: 'deal',
  sourceId: 'deal-1',
};

describe('DealEventTimeline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows editing and deleting manual events only', async () => {
    const onUpdateManualEvent = vi.fn().mockResolvedValue(undefined);
    const onDeleteManualEvent = vi.fn().mockResolvedValue(undefined);

    render(
      <DealEventTimeline
        events={[manualEvent, manualExpectedCloseEvent, policyEvent]}
        onUpdateManualEvent={onUpdateManualEvent}
        onDeleteManualEvent={onDeleteManualEvent}
      />,
    );

    expect(screen.getByText('Окончание полиса')).toBeInTheDocument();
    expect(screen.getAllByText('Изменить')).toHaveLength(2);
    expect(screen.getAllByText('Удалить')).toHaveLength(2);

    fireEvent.click(screen.getAllByText('Изменить')[0]);
    fireEvent.change(screen.getByLabelText('Причина события'), {
      target: { value: 'Клиент выбрал квартиру, вернуться с предложением' },
    });
    fireEvent.change(screen.getByLabelText('Дата события'), {
      target: { value: '2027-06-17' },
    });
    fireEvent.click(screen.getByText('Сохранить'));

    await waitFor(() => {
      expect(onUpdateManualEvent).toHaveBeenCalledWith('deal-event-event-1', {
        eventDate: '2027-06-17',
        reason: 'Клиент выбрал квартиру, вернуться с предложением',
      });
    });

    fireEvent.click(screen.getAllByText('Удалить')[0]);

    await waitFor(() => {
      expect(onDeleteManualEvent).toHaveBeenCalledWith('deal-event-event-1');
    });
  });

  it('sorts dated events by closeness and places undated events after them', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 17, 12, 0, 0));
    const todayEvent: DealTimelineEvent = {
      ...manualEvent,
      id: 'today',
      eventDate: '2026-06-17',
      title: 'Сегодня',
    };
    const tomorrowEvent: DealTimelineEvent = {
      ...manualEvent,
      id: 'tomorrow',
      eventDate: '2026-06-18',
      title: 'Завтра',
    };
    const yesterdayEvent: DealTimelineEvent = {
      ...manualEvent,
      id: 'yesterday',
      eventDate: '2026-06-16',
      title: 'Вчера',
    };
    const farEvent: DealTimelineEvent = {
      ...manualEvent,
      id: 'far',
      eventDate: '2026-07-20',
      title: 'Далеко',
    };
    const undatedEvent: DealTimelineEvent = {
      ...manualEvent,
      id: 'undated',
      eventDate: null,
      title: 'Без даты',
    };

    const { container } = render(
      <DealEventTimeline
        events={[farEvent, undatedEvent, yesterdayEvent, tomorrowEvent, todayEvent]}
      />,
    );

    const rows = Array.from(container.querySelectorAll('[data-testid^="deal-event-row-"]'));
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining('Сегодня'),
      expect.stringContaining('Завтра'),
      expect.stringContaining('Вчера'),
      expect.stringContaining('Далеко'),
      expect.stringContaining('Без даты'),
    ]);
  });

  it('uses muted styling for past events and deadline colors for upcoming events', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 17, 12, 0, 0));
    const pastEvent: DealTimelineEvent = {
      ...manualEvent,
      id: 'past',
      eventDate: '2026-06-16',
      title: 'Прошедшее',
    };
    const todayEvent: DealTimelineEvent = {
      ...manualEvent,
      id: 'today',
      eventDate: '2026-06-17',
      title: 'Сегодня',
    };
    const soonEvent: DealTimelineEvent = {
      ...manualEvent,
      id: 'soon',
      eventDate: '2026-06-20',
      title: 'Скоро',
    };
    const laterEvent: DealTimelineEvent = {
      ...manualEvent,
      id: 'later',
      eventDate: '2026-06-25',
      title: 'Позже',
    };

    render(<DealEventTimeline events={[laterEvent, soonEvent, todayEvent, pastEvent]} />);

    expect(screen.getByTestId('deal-event-row-past')).toHaveClass('opacity-75');
    expect(screen.getByTestId('deal-event-marker-past')).toHaveClass('bg-slate-100');
    expect(screen.getByTestId('deal-event-date-past')).toHaveClass('text-slate-400');
    expect(screen.getByTestId('deal-event-marker-today')).toHaveClass('bg-rose-600');
    expect(screen.getByTestId('deal-event-date-today')).toHaveClass('text-rose-700');
    expect(screen.getByTestId('deal-event-marker-soon')).toHaveClass('bg-orange-500');
    expect(screen.getByTestId('deal-event-date-soon')).toHaveClass('text-orange-700');
    expect(screen.getByTestId('deal-event-marker-later')).toHaveClass('bg-emerald-500');
    expect(screen.getByTestId('deal-event-date-later')).toHaveClass('text-emerald-700');
  });
});
