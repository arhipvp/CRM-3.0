import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  collectKnowledgeReferenceItems,
  formatKnowledgeDate,
  formatKnowledgeDateTime,
  renderKnowledgeAnswerWithCitations,
} from '../knowledgeDocuments.utils';

describe('knowledgeDocuments utils', () => {
  it('formats knowledge dates safely', () => {
    expect(formatKnowledgeDate()).toBe('—');
    expect(formatKnowledgeDate('bad-date')).toBe('—');
    expect(formatKnowledgeDate('2025-01-05T00:00:00Z')).toContain('2025');
    expect(formatKnowledgeDateTime('2025-01-05T10:15:00Z')).toContain('2025');
  });

  it('collects unique references in order', () => {
    const result = collectKnowledgeReferenceItems('A [source:one] B [source:two] C [source:one]', [
      { sourceId: 'one', documentId: 'doc-1', title: 'Первый' },
      { sourceId: 'two', documentId: 'doc-2', title: 'Второй' },
    ]);

    expect(result).toEqual([
      { sourceId: 'one', title: 'Первый', fileUrl: null },
      { sourceId: 'two', title: 'Второй', fileUrl: null },
    ]);
  });

  it('renders citations with clickable references', () => {
    const onOpenSource = vi.fn();
    const content = renderKnowledgeAnswerWithCitations(
      'Ответ [source:one] и ещё [source:two]',
      [
        { sourceId: 'one', documentId: 'doc-1', title: 'Первый' },
        { sourceId: 'two', documentId: 'doc-2', title: 'Второй' },
      ],
      onOpenSource,
    );

    render(<p>{content}</p>);

    fireEvent.click(screen.getByRole('button', { name: '[1]' }));
    expect(onOpenSource).toHaveBeenCalledWith('one');
    fireEvent.click(screen.getByRole('button', { name: '[2]' }));
    expect(onOpenSource).toHaveBeenCalledWith('two');
  });
});
