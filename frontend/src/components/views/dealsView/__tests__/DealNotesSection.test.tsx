import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealNotesSection } from '../DealNotesSection';

const note = {
  id: 'note-1',
  dealId: 'deal-1',
  body: 'Test note',
  authorName: 'Agent',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  deletedAt: null,
};

const baseProps = {
  notes: [note],
  notesLoading: false,
  notesFilter: 'active' as const,
  noteDraft: '',
  notesError: null,
  notesAction: null,
  noteAttachments: [],
  noteAttachmentsUploading: false,
  onSetFilter: vi.fn(),
  onSetDraft: vi.fn(),
  onAddNote: vi.fn(),
  onAttachNoteFile: vi.fn(),
  onRemoveNoteAttachment: vi.fn(),
  onArchiveNote: vi.fn(),
  onRestoreNote: vi.fn(),
};

describe('DealNotesSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders filters, note form and invokes handlers', () => {
    render(<DealNotesSection {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Активные' }));
    expect(baseProps.onSetFilter).toHaveBeenCalledWith('active');

    fireEvent.change(screen.getByPlaceholderText('Заметка к сделке'), {
      target: { value: 'New note' },
    });
    expect(baseProps.onSetDraft).toHaveBeenCalledWith('New note');

    fireEvent.click(screen.getByRole('button', { name: 'Добавить заметку' }));
    expect(baseProps.onAddNote).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(baseProps.onArchiveNote).toHaveBeenCalledWith(note.id);
  });

  it('shows restore action when archived', () => {
    render(
      <DealNotesSection {...baseProps} notes={[]} notesFilter="archived" notesAction={null} />,
    );

    expect(screen.getByText('Заметок не найдено.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Показать удаленные заметки' }));
    expect(baseProps.onSetFilter).toHaveBeenCalledWith('archived');
  });
});
