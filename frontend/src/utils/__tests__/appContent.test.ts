import { describe, expect, it } from 'vitest';

import type { SalesChannel } from '../../types';
import { matchSalesChannel } from '../appContent';

const channels: SalesChannel[] = [
  {
    id: '13bdc3bc-970e-427e-8aef-a8aa82e03501',
    name: 'Гриша. Альфа',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'c281c5c9-4054-4746-bf49-096214823ee8',
    name: 'Гриша. Ресо',
    createdAt: '',
    updatedAt: '',
  },
  {
    id: 'a5c18024-3590-4604-8829-b7925c3c6bf1',
    name: 'Гриша. Ингосстрах',
    createdAt: '',
    updatedAt: '',
  },
];

describe('matchSalesChannel', () => {
  it('prefers the exact channel over earlier channels sharing a token', () => {
    expect(matchSalesChannel(channels, '  ГРИША. РЕСО  ')?.id).toBe(channels[1].id);
  });

  it.each(['', '   '])('returns no channel for an empty value %j', (value) => {
    expect(matchSalesChannel(channels, value)).toBeUndefined();
  });

  it('returns no channel for an empty registry or an unmatched value', () => {
    expect(matchSalesChannel([], 'Гриша. Ресо')).toBeUndefined();
    expect(matchSalesChannel(channels, 'Неизвестный')).toBeUndefined();
  });

  it.each([
    ['Ресо', 1],
    ['Гриша.', 0],
    ['Агент Альфа', 0],
    ['Гриша. Альфа / агент', 0],
  ])('preserves fuzzy matching for %s', (value, index) => {
    expect(matchSalesChannel(channels, value)?.id).toBe(channels[index].id);
  });
});
