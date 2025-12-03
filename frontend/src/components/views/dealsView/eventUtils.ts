import type { Payment, Policy } from '../../../types';

export type DealEventType = 'payment' | 'policyExpiration';

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

const formatAmount = (amount: number) => `${amount.toLocaleString('ru-RU')} ₽`;

const normalizeAmount = (value: Payment['amount']) => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const buildPaymentDescription = (
  payment: Payment
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
    parts.push(`Сумма ${formatAmount(amount)}`);
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
    if (!policy.endDate) {
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

  return events.sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
};

export interface DealEventWindow {
  upcomingEvents: DealEvent[];
  pastEvents: DealEvent[];
  nextEvent: DealEvent | null;
  suggestedNextContactInput: string | null;
}

export const buildEventWindow = (
  events: DealEvent[],
  options?: { today?: Date }
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
