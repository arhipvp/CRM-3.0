export const POLICY_STATUS_TONE_CLASS: Record<'red' | 'orange' | 'green', string> = {
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  green: 'bg-emerald-100 text-emerald-700',
};

export const getPolicyExpiryToneClass = (tone: 'red' | 'orange') =>
  tone === 'red' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700';

export const getPolicyNotePreview = (note?: string | null) => {
  const normalized = note?.trim() ?? '';
  if (!normalized) {
    return {
      preview: 'Без примечания',
      fullText: 'Без примечания',
    };
  }

  return {
    preview: normalized,
    fullText: normalized,
  };
};
