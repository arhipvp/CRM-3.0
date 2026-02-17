import type { ParsedHotkey } from './types';

const normalizeKey = (rawKey: string): string => {
  const key = rawKey.toLowerCase();
  if (key === 'esc') {
    return 'escape';
  }
  if (key === 'space') {
    return ' ';
  }
  return key;
};

const isMacPlatform = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
};

export const parseHotkey = (combo: string): ParsedHotkey => {
  const tokens = combo
    .split('+')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  const keyToken = tokens.find(
    (token) =>
      token !== 'ctrl' &&
      token !== 'control' &&
      token !== 'cmd' &&
      token !== 'meta' &&
      token !== 'alt' &&
      token !== 'option' &&
      token !== 'shift' &&
      token !== 'mod',
  );

  const mac = isMacPlatform();
  const hasMod = tokens.includes('mod');

  return {
    key: normalizeKey(keyToken ?? ''),
    ctrl: tokens.includes('ctrl') || tokens.includes('control') || (hasMod && !mac),
    meta: tokens.includes('meta') || tokens.includes('cmd') || (hasMod && mac),
    alt: tokens.includes('alt') || tokens.includes('option'),
    shift: tokens.includes('shift'),
  };
};

export const matchHotkey = (event: KeyboardEvent, combo: string): boolean => {
  const parsed = parseHotkey(combo);
  if (!parsed.key) {
    return false;
  }

  const eventKey = normalizeKey(event.key);
  return (
    eventKey === parsed.key &&
    event.ctrlKey === parsed.ctrl &&
    event.metaKey === parsed.meta &&
    event.altKey === parsed.alt &&
    event.shiftKey === parsed.shift
  );
};
