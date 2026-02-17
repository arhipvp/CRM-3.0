import { afterEach, describe, expect, it, vi } from 'vitest';

import { formatShortcut } from '../../hotkeys/formatShortcut';
import { matchHotkey } from '../../hotkeys/matchHotkey';

describe('matchHotkey', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('matches Ctrl combination on non-mac platforms', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32');
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
    expect(matchHotkey(event, 'mod+k')).toBe(true);
  });

  it('matches Cmd combination on mac platforms', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel');
    const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
    expect(matchHotkey(event, 'mod+k')).toBe(true);
  });

  it('matches Alt+ArrowDown combinations', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32');
    const event = new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true });
    expect(matchHotkey(event, 'alt+arrowdown')).toBe(true);
  });
});

describe('formatShortcut', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders shortcuts for windows', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('Win32');
    expect(formatShortcut('mod+shift+t')).toBe('Ctrl+Shift+T');
  });

  it('renders shortcuts for mac', () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel');
    expect(formatShortcut('mod+shift+t')).toBe('Cmd+Shift+T');
  });
});
