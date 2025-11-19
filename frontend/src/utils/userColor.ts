const USER_COLOR_PALETTE = [
  '#2563eb',
  '#059669',
  '#db2777',
  '#f97316',
  '#0ea5e9',
  '#9333ea',
  '#10b981',
  '#6366f1',
];

export const getUserColor = (identifier?: string | null) => {
  if (!identifier) {
    return undefined;
  }
  let hash = 0;
  for (let i = 0; i < identifier.length; i += 1) {
    hash = (hash * 31 + identifier.charCodeAt(i)) >>> 0;
  }
  return USER_COLOR_PALETTE[hash % USER_COLOR_PALETTE.length];
};

export const hexToRgba = (hex: string, alpha: number) => {
  const cleaned = hex.replace('#', '');
  if (cleaned.length !== 6) {
    return undefined;
  }
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
