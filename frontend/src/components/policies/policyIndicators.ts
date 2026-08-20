export type PolicyExpiryBadge = {
  label: string;
  tone: 'red' | 'orange';
};

export type PolicyRenewalBadge = {
  label: string;
  tone: 'sky';
  tooltip: string;
};

export type PolicyComputedStatusValue = 'problem' | 'due' | 'expired' | 'active';
export type PolicyComputedStatusBadge = {
  value: PolicyComputedStatusValue;
  label: string;
  tooltip: string;
  tone: 'red' | 'orange' | 'green';
};

export type PolicyTermIndicator = {
  label: string;
  tone: 'green' | 'orange' | 'red' | 'neutral';
};

export const getPolicyTermIndicator = (endDate?: string | null): PolicyTermIndicator => {
  if (!endDate) {
    return { label: 'Не указано', tone: 'neutral' };
  }

  const parsed = new Date(`${endDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    return { label: 'Не указано', tone: 'neutral' };
  }

  const today = new Date();
  const todayAtMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.ceil((parsed.getTime() - todayAtMidnight.getTime()) / 86_400_000);

  if (diffDays < 0) {
    return { label: `Просрочен ${Math.abs(diffDays)} дн.`, tone: 'red' };
  }
  if (diffDays <= 30) {
    return { label: diffDays === 0 ? 'Истекает сегодня' : `${diffDays} дн.`, tone: 'orange' };
  }
  return { label: `${diffDays} дн.`, tone: 'green' };
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
    return { label: 'Истекает <= 3 дн.', tone: 'orange' };
  }
  if (diffDays <= 7) {
    return { label: 'Истекает <= 7 дн.', tone: 'orange' };
  }
  if (diffDays <= 15) {
    return { label: 'Истекает <= 15 дн.', tone: 'orange' };
  }
  if (diffDays <= 30) {
    return { label: 'Истекает <= 30 дн.', tone: 'orange' };
  }
  return null;
};

export const getPolicyComputedStatusBadge = (status?: string): PolicyComputedStatusBadge | null => {
  if (status === 'problem') {
    return {
      value: 'problem',
      label: 'Есть неоплаченные записи',
      tooltip: 'Есть финансовые записи без даты оплаты по платежам полиса',
      tone: 'red',
    };
  }
  if (status === 'due') {
    return {
      value: 'due',
      label: 'К оплате',
      tooltip: 'Есть платежи без фактической даты оплаты',
      tone: 'orange',
    };
  }
  if (status === 'expired') {
    return {
      value: 'expired',
      label: 'Просрочен',
      tooltip: 'Дата окончания полиса уже в прошлом',
      tone: 'red',
    };
  }
  if (status === 'active') {
    return {
      value: 'active',
      label: 'Активен',
      tooltip: 'Полис действует и не содержит неоплаченных записей или платежей',
      tone: 'green',
    };
  }
  return null;
};

export const getPolicyRenewalBadge = ({
  isRenewed,
}: {
  isRenewed?: boolean;
}): PolicyRenewalBadge | null => {
  if (!isRenewed) {
    return null;
  }
  return {
    label: 'Продлён',
    tone: 'sky',
    tooltip: 'Полис отмечен как продлённый',
  };
};
