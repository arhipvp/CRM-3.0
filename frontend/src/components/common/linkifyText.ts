export type LinkPart =
  | {
      type: 'text';
      value: string;
    }
  | {
      type: 'link';
      value: string;
      href: string;
    };

const SITE_PATTERN = /(?:https?:\/\/)?(?:www\.)?(?:[\p{L}\p{N}-]+\.)+[\p{L}]{2,}(?:\/[^\s<]*)?/giu;
const TRAILING_PUNCTUATION = /[),.;!?]+$/u;

const trimTrailingPunctuation = (value: string) => {
  const trimmed = value.replace(TRAILING_PUNCTUATION, '');
  return trimmed || value;
};

const toHref = (value: string) => {
  if (/^https?:\/\//iu.test(value)) {
    return value;
  }
  return `https://${value}`;
};

export const splitTextToLinks = (text: string): LinkPart[] => {
  const parts: LinkPart[] = [];
  let cursor = 0;

  for (const match of text.matchAll(SITE_PATTERN)) {
    const rawMatch = match[0] ?? '';
    const start = match.index ?? 0;
    const candidate = trimTrailingPunctuation(rawMatch);
    if (!candidate) {
      continue;
    }
    if (start > 0 && text[start - 1] === '@') {
      continue;
    }

    const end = start + candidate.length;
    if (cursor < start) {
      parts.push({ type: 'text', value: text.slice(cursor, start) });
    }

    parts.push({
      type: 'link',
      value: candidate,
      href: toHref(candidate),
    });
    cursor = end;
  }

  if (cursor < text.length) {
    parts.push({ type: 'text', value: text.slice(cursor) });
  }

  return parts;
};
