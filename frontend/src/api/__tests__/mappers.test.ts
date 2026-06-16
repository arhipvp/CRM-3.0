import { describe, expect, it } from 'vitest';

import { mapDealTimelineEvent, mapTask } from '../mappers';

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
});
