import type { DealTimelineEvent, Payment, Policy } from '../../../types';
import { formatCurrencyRu } from '../../../utils/formatting';

export type DealEventType = 'payment' | 'policyExpiration' | 'manualDeadline';

export interface DealEvent {
  id: string;
  type: DealEventType;
  date: string;
  title: string;
  description?: string;
  policyNumber?: string;
  amount?: number;
}

const buildPolicyDescription = (policy: Policy) => {
  const parts: string[] = [];
  if (policy.number) {
    parts.push(`Полис ${policy.number}`);
  }
  if (policy.insuranceCompany) {
    parts.push(policy.insuranceCompany);
  }
  if (parts.length) {
    return parts.join(' · ');
  }
  return 'Окончание страхования';
};

const normalizeAmount = (value: Payment['amount']) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPaymentDescription = (
  payment: Payment,
): { description: string; amount: number | null } => {
  const parts: string[] = [];
  if (payment.description) {
    parts.push(payment.description);
  }
  if (payment.policyNumber) {
    parts.push(`по полису ${payment.policyNumber}`);
  }
  const amount = normalizeAmount(payment.amount);
  if (amount !== null) {
    parts.push(`Сумма ${formatCurrencyRu(amount)}`);
  }
  if (parts.length) {
    return {
      description: parts.join(' · '),
      amount,
    };
  }
  return { description: 'Платёж', amount };
};

export const buildDealEvents = ({
  policies,
  payments,
}: {
  policies: Policy[];
  payments: Payment[];
}): DealEvent[] => {
  const events: DealEvent[] = [];

  policies.forEach((policy) => {
    if (!policy.endDate || policy.isRenewed) {
      return;
    }
    events.push({
      id: `policy-${policy.id}`,
      type: 'policyExpiration',
      date: policy.endDate,
      title: 'Окончание полиса',
      description: buildPolicyDescription(policy),
      policyNumber: policy.number,
    });
  });

  payments.forEach((payment) => {
    if (payment.actualDate) {
      return;
    }
    const eventDate = payment.scheduledDate ?? payment.actualDate;
    if (!eventDate) {
      return;
    }
    const { description, amount } = buildPaymentDescription(payment);
    events.push({
      id: `payment-${payment.id}`,
      type: 'payment',
      date: eventDate,
      title: 'Очередной платёж',
      description,
      policyNumber: payment.policyNumber,
      amount: amount ?? undefined,
    });
  });

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
};

const TIMELINE_DEADLINE_TYPES: ReadonlySet<DealTimelineEvent['eventType']> = new Set([
  'manual_expected_close',
  'payment_due',
  'policy_expiration',
]);

const timelineEventTypeMap: Record<
  Extract<
    DealTimelineEvent['eventType'],
    'manual_expected_close' | 'payment_due' | 'policy_expiration'
  >,
  DealEventType
> = {
  manual_expected_close: 'manualDeadline',
  payment_due: 'payment',
  policy_expiration: 'policyExpiration',
};

const normalizeMetadataAmount = (value: unknown) => {
  const amount =
    typeof value === 'number'
      ? normalizeAmount(String(value))
      : typeof value === 'string'
        ? normalizeAmount(value)
        : null;
  return amount ?? undefined;
};

export const buildDealEventsFromTimeline = (events: DealTimelineEvent[]): DealEvent[] =>
  events
    .filter(
      (
        event,
      ): event is DealTimelineEvent & {
        eventType: 'manual_expected_close' | 'payment_due' | 'policy_expiration';
        eventDate: string;
      } => Boolean(event.eventDate) && TIMELINE_DEADLINE_TYPES.has(event.eventType),
    )
    .map(
      (event): DealEvent => ({
        id: event.id,
        type: timelineEventTypeMap[event.eventType],
        date: event.eventDate,
        title: event.title,
        description: event.description || undefined,
        policyNumber:
          typeof event.metadata.policyNumber === 'string' ? event.metadata.policyNumber : undefined,
        amount: normalizeMetadataAmount(event.metadata.amount),
      }),
    )
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

export interface DealEventWindow {
  upcomingEvents: DealEvent[];
  pastEvents: DealEvent[];
  nextEvent: DealEvent | null;
  suggestedNextContactInput: string | null;
}

export const buildEventWindow = (
  events: DealEvent[],
  options?: { today?: Date },
): DealEventWindow => {
  const today = options?.today ? new Date(options.today) : new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();

  if (!events.length) {
    return {
      upcomingEvents: [],
      pastEvents: [],
      nextEvent: null,
      suggestedNextContactInput: null,
    };
  }

  const upcoming: DealEvent[] = [];
  const past: DealEvent[] = [];

  events.forEach((event) => {
    const eventDate = new Date(event.date);
    if (Number.isNaN(eventDate.getTime())) {
      return;
    }
    if (eventDate.getTime() >= todayMs) {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  });

  const nextEvent = upcoming[0] ?? events[0] ?? null;
  if (!nextEvent) {
    return {
      upcomingEvents: upcoming,
      pastEvents: past,
      nextEvent: null,
      suggestedNextContactInput: null,
    };
  }

  const offsetDays = nextEvent.type === 'payment' ? 30 : 45;
  const offsetDate = new Date(nextEvent.date);
  offsetDate.setDate(offsetDate.getDate() - offsetDays);
  const suggestedMs = Math.max(offsetDate.getTime(), todayMs);
  const suggestedNextContactInput = Number.isFinite(suggestedMs)
    ? new Date(suggestedMs).toISOString().split('T')[0]
    : null;

  return {
    upcomingEvents: upcoming,
    pastEvents: past,
    nextEvent,
    suggestedNextContactInput,
  };
};
