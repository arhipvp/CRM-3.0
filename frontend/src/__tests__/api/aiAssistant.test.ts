import { describe, expect, it } from 'vitest';

import { aiDocumentPageFragment, formatAiCitationLocation } from '../../api/aiAssistant';

describe('AI document links', () => {
  it('adds the cited PDF page as a browser fragment', () => {
    expect(aiDocumentPageFragment({ page: 11 })).toBe('#page=11');
  });

  it('does not add a PDF fragment for non-page citations', () => {
    expect(aiDocumentPageFragment({ sheet: 'КАСКО' })).toBe('');
    expect(formatAiCitationLocation({ sheet: 'КАСКО' })).toBe('лист КАСКО');
  });
});
