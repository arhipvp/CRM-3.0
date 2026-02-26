import { describe, expect, it } from 'vitest';

import { getBackgroundRefreshResources } from '../../utils/appContent';

describe('getBackgroundRefreshResources', () => {
  it('returns deals-only refresh for deals route', () => {
    expect(getBackgroundRefreshResources('/deals')).toEqual(['deals']);
    expect(getBackgroundRefreshResources('/deals?dealId=1')).toEqual(['deals']);
  });

  it('returns finance + policies for commissions route', () => {
    expect(getBackgroundRefreshResources('/commissions')).toEqual(['finance', 'policies']);
  });

  it('returns tasks + deals for tasks route', () => {
    expect(getBackgroundRefreshResources('/tasks')).toEqual(['tasks', 'deals']);
  });
});
