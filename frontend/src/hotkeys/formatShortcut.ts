const isMacPlatform = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return /mac|iphone|ipad|ipod/i.test(navigator.platform || navigator.userAgent);
};

const formatToken = (token: string, mac: boolean): string => {
  switch (token) {
    case 'mod':
      return mac ? 'Cmd' : 'Ctrl';
    case 'ctrl':
    case 'control':
      return 'Ctrl';
    case 'meta':
    case 'cmd':
      return 'Cmd';
    case 'alt':
    case 'option':
      return 'Alt';
    case 'shift':
      return 'Shift';
    case 'escape':
    case 'esc':
      return 'Esc';
    case ' ':
    case 'space':
      return 'Space';
    case '/':
      return '/';
    default:
      return token.length === 1
        ? token.toUpperCase()
        : `${token[0].toUpperCase()}${token.slice(1)}`;
  }
};

export const formatShortcut = (combo: string): string => {
  const mac = isMacPlatform();
  return combo
    .split('+')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .map((token) => formatToken(token, mac))
    .join('+');
};
