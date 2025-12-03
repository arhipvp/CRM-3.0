export const parseNumericAmount = (raw?: string | null): number => {
  if (!raw) {
    return NaN;
  }
  const normalized = raw.replace(/\s+/g, '').replace(',', '.');
  return Number(normalized);
};
