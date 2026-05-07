const SEPARATED_RU_DATE_PATTERN = /^(\d{2})[./-](\d{2})[./-](\d{4})$/;
const COMPACT_RU_DATE_PATTERN = /^(\d{2})(\d{2})(\d{4})$/;

const toIsoDate = (dayText: string, monthText: string, yearText: string): string | null => {
  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (day < 1 || month < 1 || month > 12 || year < 1) {
    return null;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }

  return `${yearText}-${monthText}-${dayText}`;
};

export const parseClipboardDateToIso = (value: string): string | null => {
  const trimmed = value.trim();
  const separatedMatch = trimmed.match(SEPARATED_RU_DATE_PATTERN);
  if (separatedMatch) {
    return toIsoDate(separatedMatch[1], separatedMatch[2], separatedMatch[3]);
  }

  const compactMatch = trimmed.match(COMPACT_RU_DATE_PATTERN);
  if (compactMatch) {
    return toIsoDate(compactMatch[1], compactMatch[2], compactMatch[3]);
  }

  return null;
};
