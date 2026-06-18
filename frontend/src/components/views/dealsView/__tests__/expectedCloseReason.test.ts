import { describe, expect, it } from 'vitest';

import type { DealTimelineEvent } from '../../../../types';
import { resolveExpectedCloseReason } from '../expectedCloseReason';

const makeEvent = (
  overrides: Partial<DealTimelineEvent> & Pick<DealTimelineEvent, 'id' | 'eventType' | 'eventDate'>,
): DealTimelineEvent => ({
  deal: 'deal-1',
  eventTypeDisplay: overrides.eventType,
  title: 'Событие',
  description: '',
  sourceType: '',
  sourceId: '',
  actor: null,
  actorUsername: null,
  actorDisplayName: null,
  metadata: {},
  createdAt: '2024-01-01T10:00:00Z',
  ...overrides,
});

describe('resolveExpectedCloseReason', () => {
  it('returns exact policy, payment and manual deadline reasons', () => {
    const result = resolveExpectedCloseReason('2027-06-26', [
      makeEvent({
        id: 'policy-1',
        eventType: 'policy_expiration',
        eventDate: '2027-06-26',
        title: 'Окончание полиса',
      }),
      makeEvent({
        id: 'payment-1',
        eventType: 'payment_due',
        eventDate: '2027-06-26',
        title: 'Очередной платёж',
      }),
      makeEvent({
        id: 'manual-deadline-1',
        eventType: 'manual_expected_close',
        eventDate: '2027-06-26',
        title: 'Дата выставлена вручную',
      }),
    ]);

    expect(result.status).toBe('exact');
    expect(result.events.map((event) => event.id)).toEqual([
      'policy-1',
      'payment-1',
      'manual-deadline-1',
    ]);
  });

  it('uses generic manual event only for exact date explanation', () => {
    const exact = resolveExpectedCloseReason('2027-06-26', [
      makeEvent({
        id: 'manual-1',
        eventType: 'manual',
        eventDate: '2027-06-26',
        title: 'Предположительно купит квартиру',
      }),
    ]);

    const mismatch = resolveExpectedCloseReason('2027-06-27', [
      makeEvent({
        id: 'manual-1',
        eventType: 'manual',
        eventDate: '2027-06-26',
        title: 'Предположительно купит квартиру',
      }),
    ]);

    expect(exact.status).toBe('exact');
    expect(exact.events).toHaveLength(1);
    expect(mismatch.status).toBe('empty');
    expect(mismatch.events).toHaveLength(0);
  });

  it('returns mismatch with nearest deadline source when dates do not match', () => {
    const result = resolveExpectedCloseReason('2026-06-26', [
      makeEvent({
        id: 'policy-1',
        eventType: 'policy_expiration',
        eventDate: '2027-06-26',
        title: 'Окончание полиса',
      }),
      makeEvent({
        id: 'payment-1',
        eventType: 'payment_due',
        eventDate: '2026-06-27',
        title: 'Очередной платёж',
      }),
    ]);

    expect(result.status).toBe('mismatch');
    expect(result.events[0]?.id).toBe('payment-1');
    expect(result.message).toContain('Ближайшее основание: очередной платёж 27.06.2026');
    expect(result.message).toContain('крайний срок сейчас 26.06.2026');
  });

  it('returns explicit empty state when no deadline sources exist', () => {
    const result = resolveExpectedCloseReason('2026-06-26', []);

    expect(result.status).toBe('empty');
    expect(result.message).toBe('Нет событий, которые объясняют крайний срок.');
  });
});
