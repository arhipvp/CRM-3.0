export const normalizeNumericAmount = (raw?: string | null): string | null => {
  if (!raw) {
    return null;
  }

  const compact = raw.trim().replace(/[\s\u00a0\u202f]/g, '');
  if (!compact || !/^[+-]?[\d.,]+$/.test(compact)) {
    return null;
  }

  const lastComma = compact.lastIndexOf(',');
  const lastDot = compact.lastIndexOf('.');
  const decimalSeparator =
    lastComma === -1
      ? lastDot === -1
        ? null
        : '.'
      : lastDot === -1
        ? ','
        : lastComma > lastDot
          ? ','
          : '.';
  const decimalIndex = decimalSeparator ? compact.lastIndexOf(decimalSeparator) : -1;
  const integerRaw = decimalSeparator ? compact.slice(0, decimalIndex) : compact;
  const fractionRaw = decimalSeparator ? compact.slice(decimalIndex + 1) : '';
  const hasMixedSeparators = lastComma !== -1 && lastDot !== -1;

  if (hasMixedSeparators && decimalSeparator) {
    const groupingSeparator = decimalSeparator === ',' ? '.' : ',';
    const groups = integerRaw.replace(/^[+-]/, '').split(groupingSeparator);
    if (
      integerRaw.includes(decimalSeparator) ||
      fractionRaw.includes(',') ||
      fractionRaw.includes('.') ||
      !/^\d{1,3}$/.test(groups[0]) ||
      groups.slice(1).some((group) => !/^\d{3}$/.test(group))
    ) {
      return null;
    }
  }

  const integerPart = decimalSeparator
    ? integerRaw.replace(/[.,]/g, '')
    : compact.replace(/[.,]/g, '');
  const fractionPart = decimalSeparator ? fractionRaw.replace(/[.,]/g, '') : '';

  if (!integerPart || (decimalSeparator && !fractionPart)) {
    return null;
  }

  const normalized = `${integerPart}${fractionPart ? `.${fractionPart}` : ''}`;
  return Number.isFinite(Number(normalized)) ? normalized : null;
};

export const parseNumericAmount = (raw?: string | null): number => {
  const normalized = normalizeNumericAmount(raw);
  return normalized === null ? NaN : Number(normalized);
};
