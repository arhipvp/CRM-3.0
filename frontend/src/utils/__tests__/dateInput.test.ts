import { describe, expect, it } from 'vitest';

import { parseClipboardDateToIso } from '../dateInput';

describe('parseClipboardDateToIso', () => {
  it.each([
    ['26.02.1986', '1986-02-26'],
    ['26/02/1986', '1986-02-26'],
    ['26-02-1986', '1986-02-26'],
    ['26021986', '1986-02-26'],
  ])('parses %s as %s', (input, expected) => {
    expect(parseClipboardDateToIso(input)).toBe(expected);
  });

  it.each(['31.02.1986', '2602198', '19860226', '00.12.1986', '26.13.1986'])(
    'ignores invalid date %s',
    (input) => {
      expect(parseClipboardDateToIso(input)).toBeNull();
    },
  );
});
