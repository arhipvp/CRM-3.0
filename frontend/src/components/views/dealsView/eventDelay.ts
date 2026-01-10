import type { DealEvent } from './eventUtils';

export const calculateNextContactForEvent = (event: DealEvent | null) => {
  if (!event) {
    return null;
  }
  const offsetDays = event.type === 'payment' ? 30 : 45;
  const target = new Date(event.date);
  target.setDate(target.getDate() - offsetDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextContactMs = Math.max(target.getTime(), today.getTime());
  return new Date(nextContactMs).toISOString().split('T')[0];
};

export const resolveSelectedDelayEvent = (
  dealEvents: DealEvent[],
  selectedDelayEventId: string | null,
  nextEventId: string | null,
) => {
  const preferredId = selectedDelayEventId ?? nextEventId ?? dealEvents[0]?.id ?? null;
  return dealEvents.find((event) => event.id === preferredId) ?? null;
};
