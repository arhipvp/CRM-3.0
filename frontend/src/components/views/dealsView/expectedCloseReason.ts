import type { DealTimelineEvent } from '../../../types';
import { formatDate } from './helpers';

export type ExpectedCloseReasonStatus = 'exact' | 'mismatch' | 'empty';

export interface ExpectedCloseReasonResult {
  status: ExpectedCloseReasonStatus;
  events: DealTimelineEvent[];
  message?: string;
}

const EXACT_REASON_TYPES: ReadonlySet<DealTimelineEvent['eventType']> = new Set([
  'policy_expiration',
  'payment_due',
  'manual_expected_close',
]);

const DEADLINE_SOURCE_TYPES: ReadonlySet<DealTimelineEvent['eventType']> = new Set([
  'policy_expiration',
  'payment_due',
  'manual_expected_close',
]);

const getEventDateMs = (event: DealTimelineEvent) => {
  if (!event.eventDate) {
    return null;
  }
  const value = new Date(event.eventDate).getTime();
  return Number.isFinite(value) ? value : null;
};

const sortByEventDate = (events: DealTimelineEvent[]) =>
  [...events].sort((a, b) => {
    const aMs = getEventDateMs(a) ?? Number.MAX_SAFE_INTEGER;
    const bMs = getEventDateMs(b) ?? Number.MAX_SAFE_INTEGER;
    return aMs - bMs;
  });

export const resolveExpectedCloseReason = (
  expectedClose: string | null | undefined,
  events: DealTimelineEvent[],
): ExpectedCloseReasonResult => {
  if (!expectedClose) {
    return {
      status: 'empty',
      events: [],
      message: 'Крайний срок не задан.',
    };
  }

  const exactEvents = sortByEventDate(
    events.filter(
      (event) => event.eventDate === expectedClose && EXACT_REASON_TYPES.has(event.eventType),
    ),
  );

  if (exactEvents.length > 0) {
    return {
      status: 'exact',
      events: exactEvents,
    };
  }

  const deadlineCandidates = sortByEventDate(
    events.filter(
      (event) => Boolean(event.eventDate) && DEADLINE_SOURCE_TYPES.has(event.eventType),
    ),
  );

  const nearestCandidate = deadlineCandidates[0];
  if (nearestCandidate) {
    return {
      status: 'mismatch',
      events: [nearestCandidate],
      message: `Ближайшее основание: ${nearestCandidate.title.toLowerCase()} ${formatDate(
        nearestCandidate.eventDate,
      )}, но крайний срок сейчас ${formatDate(expectedClose)}.`,
    };
  }

  return {
    status: 'empty',
    events: [],
    message: 'Нет событий, которые объясняют крайний срок.',
  };
};
