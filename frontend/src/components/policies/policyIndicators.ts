export type PolicyExpiryBadge = {
  label: string;
  tone: 'red' | 'orange';
};

export const getPolicyExpiryBadge = (endDate?: string | null): PolicyExpiryBadge | null => {
  if (!endDate) {
    return null;
  }
  const parsed = new Date(endDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const today = new Date();
  const diffDays = Math.ceil((parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) {
    return { label: 'Просрочен', tone: 'red' };
  }
  if (diffDays <= 3) {
    return { label: 'Истекает ≤ 3 дн.', tone: 'orange' };
  }
  if (diffDays <= 7) {
    return { label: 'Истекает ≤ 7 дн.', tone: 'orange' };
  }
  if (diffDays <= 15) {
    return { label: 'Истекает ≤ 15 дн.', tone: 'orange' };
  }
  if (diffDays <= 30) {
    return { label: 'Истекает ≤ 30 дн.', tone: 'orange' };
  }
  return null;
};
