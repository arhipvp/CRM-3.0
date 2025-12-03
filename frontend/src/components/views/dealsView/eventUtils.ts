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
    parts.push(`╨Я╨╛╨╗╨╕╤Б ${policy.number}`);
  }
  if (policy.insuranceCompany) {
    parts.push(policy.insuranceCompany);
  }
  if (parts.length) {
    return parts.join(' ┬╖ ');
  }
  return '╨Ю╨║╨╛╨╜╤З╨░╨╜╨╕╨╡ ╤Б╤В╤А╨░╤Е╨╛╨▓╨░╨╜╨╕╤П';
};

const formatAmount = (amount: number) =>
  `${amount.toLocaleString('ru-RU')} тВ╜`;

const normalizeAmount = (value: Payment['amount']) => {
  const parsed = typeof value === 'number' ? value : Number(value);
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
    parts.push(`╨┐╨╛ ╨┐╨╛╨╗╨╕╤Б╤Г ${payment.policyNumber}`);
  }
  const numericAmount = normalizeAmount(payment.amount);
  if (numericAmount !== null) {
    parts.push(`╨б╤Г╨╝╨╝╨░ ${formatAmount(numericAmount)}`);
  }
  if (parts.length) {
    return {
      description: parts.join(' ┬╖ '),
      amount: numericAmount,
    };
  }
  return { description: '╨Я╨╗╨░╤В╨╡╨╢', amount: numericAmount };
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
      title: '╨Ю╨║╨╛╨╜╤З╨░╨╜╨╕╨╡ ╨┐╨╛╨╗╨╕╤Б╨░',
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
      title: '╨Ю╤З╨╡╤А╨╡╨┤╨╜╨╛╨╣ ╨┐╨╗╨░╤В╤С╨╢',
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
