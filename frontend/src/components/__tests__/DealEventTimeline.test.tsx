import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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

describe('DealEventTimeline', () => {
  it('allows editing and deleting manual events only', async () => {
    const onUpdateManualEvent = vi.fn().mockResolvedValue(undefined);
    const onDeleteManualEvent = vi.fn().mockResolvedValue(undefined);

    render(
      <DealEventTimeline
        events={[manualEvent, policyEvent]}
        onUpdateManualEvent={onUpdateManualEvent}
        onDeleteManualEvent={onDeleteManualEvent}
      />,
    );

    expect(screen.getByText('Окончание полиса')).toBeInTheDocument();
    expect(screen.getAllByText('Изменить')).toHaveLength(1);
    expect(screen.getAllByText('Удалить')).toHaveLength(1);

    fireEvent.click(screen.getByText('Изменить'));
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

    fireEvent.click(screen.getByText('Удалить'));

    await waitFor(() => {
      expect(onDeleteManualEvent).toHaveBeenCalledWith('deal-event-event-1');
    });
  });
});
