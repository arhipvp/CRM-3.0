import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DealNotesSection } from '../DealNotesSection';

const note = {
  id: 'note-1',
  dealId: 'deal-1',
  body: 'Test note',
  authorName: 'Agent',
  isImportant: false,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  deletedAt: null,
};

const baseProps = {
  dealId: 'deal-1',
  notes: [note],
  notesLoading: false,
  notesFilter: 'active' as const,
  noteDraft: '',
  noteIsImportant: false,
  notesError: null,
  notesAction: null,
  noteAttachments: [],
  noteAttachmentsUploading: false,
  onSetFilter: vi.fn(),
  onSetDraft: vi.fn(),
  onToggleImportant: vi.fn(),
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

  it('renders filters, note modal and invokes handlers', () => {
    render(<DealNotesSection {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Активные' }));
    expect(baseProps.onSetFilter).toHaveBeenCalledWith('active');

    fireEvent.click(screen.getByRole('button', { name: 'Добавить заметку' }));

    const dialog = screen.getByRole('dialog');

    fireEvent.change(screen.getByPlaceholderText('Заметка к сделке'), {
      target: { value: 'New note' },
    });
    expect(baseProps.onSetDraft).toHaveBeenCalledWith('New note');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Добавить заметку' }));
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
