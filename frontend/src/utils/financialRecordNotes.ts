import type { SalesChannel } from '../types';

const COMMISSION_NOTE_BASE = 'Комиссионное вознаграждение';

export const resolveSalesChannelName = (
  channels: SalesChannel[],
  channelId?: string
): string | undefined => {
  if (!channelId) {
    return undefined;
  }
  return channels.find((channel) => channel.id === channelId)?.name;
};

export const buildCommissionIncomeNote = (salesChannelName?: string): string => {
  const normalizedName = salesChannelName?.trim();
  if (!normalizedName) {
    return COMMISSION_NOTE_BASE;
  }
  return `${COMMISSION_NOTE_BASE} от ${normalizedName}`;
};

export const shouldAutofillCommissionNote = (note?: string): boolean => {
  const normalized = note?.trim() ?? '';
  return (
    normalized === '' ||
    normalized === COMMISSION_NOTE_BASE ||
    normalized.startsWith(`${COMMISSION_NOTE_BASE} от `)
  );
};
