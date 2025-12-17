export const DEFAULT_PLACEHOLDER = '—';

export const RU_LOCALE = 'ru-RU';
export const RUB_CURRENCY = 'RUB';

export function formatDateRu(value?: string | null, fallback = DEFAULT_PLACEHOLDER): string {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toLocaleDateString(RU_LOCALE);
}

export function formatDateTimeRu(value?: string | null, fallback = DEFAULT_PLACEHOLDER): string {
  if (!value) {
    return fallback;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toLocaleString(RU_LOCALE);
}

export function formatCurrencyRu(
  amount: number | string | null | undefined,
  fallback = DEFAULT_PLACEHOLDER
): string {
  if (amount === null || amount === undefined) {
    return fallback;
  }
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return value.toLocaleString(RU_LOCALE, { style: 'currency', currency: RUB_CURRENCY });
}

