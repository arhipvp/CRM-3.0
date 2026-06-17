import { describe, expect, it } from 'vitest';

import { mapDeal, mapDealTimelineEvent, mapTask } from '../mappers';

describe('mapTask', () => {
  it('maps completion comment from API payload', () => {
    const task = mapTask({
      id: 'task-1',
      title: 'Проверить договор',
      status: 'done',
      priority: 'normal',
      checklist: [],
      created_at: '2026-04-24T10:00:00Z',
      completion_comment: 'Посчитано в Сбер.',
    });

    expect(task.completionComment).toBe('Посчитано в Сбер.');
  });
});

describe('mapDeal', () => {
  it('maps manual expected close from API payload', () => {
    const deal = mapDeal({
      id: 'deal-1',
      title: 'Deal',
      client: 'client-1',
      status: 'open',
      expected_close: '2026-07-01',
      manual_expected_close: '2026-08-01',
      created_at: '2026-06-17T10:00:00Z',
    });

    expect(deal.expectedClose).toBe('2026-07-01');
    expect(deal.manualExpectedClose).toBe('2026-08-01');
  });
});

describe('mapDealTimelineEvent', () => {
  it('maps event payload from API', () => {
    const event = mapDealTimelineEvent({
      id: 'event-1',
      deal: 'deal-1',
      event_type: 'policy_expiration',
      event_type_display: 'Окончание полиса',
      event_date: '2026-08-15',
      title: 'Окончание полиса',
      description: 'полис POL-777',
      source_type: 'policy',
      source_id: 'policy-1',
      actor: null,
      actor_username: null,
      actor_display_name: null,
      metadata: { policy_number: 'POL-777' },
      created_at: '2026-06-17T10:00:00Z',
    });

    expect(event.eventType).toBe('policy_expiration');
    expect(event.eventDate).toBe('2026-08-15');
    expect(event.metadata.policy_number).toBe('POL-777');
  });

  it('maps manual event payload from API', () => {
    const event = mapDealTimelineEvent({
      id: 'deal-event-event-1',
      deal: 'deal-1',
      event_type: 'manual',
      event_type_display: 'Ручное событие',
      event_date: '2027-06-16',
      title: 'Предположительно купит квартиру, предложить застраховать',
      description: '',
      source_type: '',
      source_id: '',
      actor: 'user-1',
      actor_username: 'seller',
      actor_display_name: 'Seller',
      metadata: {},
      created_at: '2026-06-17T10:00:00Z',
    });

    expect(event.eventType).toBe('manual');
    expect(event.eventDate).toBe('2027-06-16');
    expect(event.title).toBe('Предположительно купит квартиру, предложить застраховать');
    expect(event.sourceType).toBe('');
  });
});
