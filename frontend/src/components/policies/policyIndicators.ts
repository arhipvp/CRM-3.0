export type PolicyExpiryBadge = {
  label: string;
  tone: 'red' | 'orange';
};

export type PolicyComputedStatusValue = 'problem' | 'due' | 'expired' | 'active';
export type PolicyComputedStatusBadge = {
  value: PolicyComputedStatusValue;
  label: string;
  tone: 'red' | 'orange' | 'green';
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

export const getPolicyComputedStatusBadge = (status?: string): PolicyComputedStatusBadge | null => {
  if (status === 'problem') {
    return { value: 'problem', label: 'Проблема', tone: 'red' };
  }
  if (status === 'due') {
    return { value: 'due', label: 'К оплате', tone: 'orange' };
  }
  if (status === 'expired') {
    return { value: 'expired', label: 'Просрочен', tone: 'red' };
  }
  if (status === 'active') {
    return { value: 'active', label: 'Активен', tone: 'green' };
  }
  return null;
};
