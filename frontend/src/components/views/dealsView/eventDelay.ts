import type { DealEvent } from './eventUtils';

export const calculateNextContactForEvent = (event: DealEvent | null, leadDays: number) => {
  if (!event) {
    return null;
  }
  const normalizedLeadDays = Number.isFinite(leadDays) && leadDays > 0 ? leadDays : 90;
  const target = new Date(event.date);
  target.setDate(target.getDate() - normalizedLeadDays);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const nextContactMs = Math.max(target.getTime(), today.getTime());
  if (!Number.isFinite(nextContactMs)) {
    return null;
  }
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
