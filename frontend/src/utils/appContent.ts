import type { CurrentUserResponse } from '../api';
import type { SalesChannel, User } from '../types';
import { parseNumericAmount } from './parseNumericAmount';

const resolveRoleNames = (userData: CurrentUserResponse): string[] => {
  const parsed =
    userData.user_roles
      ?.map((ur) => ur.role?.name)
      .filter((name): name is string => Boolean(name)) ?? [];
  if (parsed.length > 0) {
    return parsed;
  }
  return userData.roles ?? [];
};

export const mapApiUser = (userData: CurrentUserResponse): User => ({
  id: String(userData.id),
  username: userData.username,
  roles: resolveRoleNames(userData),
  firstName: userData.first_name ?? undefined,
  lastName: userData.last_name ?? undefined,
});

export const parseAmountValue = (value?: string | null) => {
  const parsed = parseNumericAmount(value ?? '');
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatAmountValue = (value: number) => value.toFixed(2);

export const matchSalesChannel = (
  channels: SalesChannel[],
  recognizedValue: string
): SalesChannel | undefined => {
  const normalizedValue = recognizedValue.trim().toLowerCase();
  if (!normalizedValue) {
    return undefined;
  }
  return channels.find((channel) => {
    const channelName = channel.name.toLowerCase();
    if (channelName === normalizedValue) {
      return true;
    }
    if (channelName.includes(normalizedValue) || normalizedValue.includes(channelName)) {
      return true;
    }
    const normalizedTokens = normalizedValue.split(/\s+/).filter(Boolean);
    const channelTokens = channelName.split(/\s+/).filter(Boolean);
    if (normalizedTokens.some((token) => channelTokens.some((channelToken) => channelToken.includes(token)))) {
      return true;
    }
    if (channelTokens.some((token) => normalizedValue.includes(token))) {
      return true;
    }
    return false;
  });
};
