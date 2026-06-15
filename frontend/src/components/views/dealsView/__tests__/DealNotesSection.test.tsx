import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DriveFile } from '../../../../types';
import { DealNotesSection } from '../DealNotesSection';

const note = {
  id: 'note-1',
  dealId: 'deal-1',
  body: 'Test note bampadu.ru/form',
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

    const noteLink = screen.getByRole('link', { name: 'bampadu.ru/form' });
    expect(noteLink).toHaveAttribute('href', 'https://bampadu.ru/form');
    expect(noteLink).toHaveAttribute('target', '_blank');

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

  it('keeps the note form compact when an attachment is present', () => {
    const attachment: DriveFile = {
      id: 'file-1',
      name: 'document.pdf',
      mimeType: 'application/pdf',
      size: 123,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://example.com/document.pdf',
      isFolder: false,
    };

    render(<DealNotesSection {...baseProps} noteAttachments={[attachment]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Добавить заметку' }));

    const dialog = screen.getByRole('dialog', { name: 'Новая заметка' });
    const textarea = within(dialog).getByPlaceholderText('Заметка к сделке');
    const dropArea = within(dialog).getByText('Нажмите или перетащите файл сюда').parentElement
      ?.parentElement;

    expect(textarea).toHaveAttribute('rows', '4');
    expect(within(dialog).getByText('Вложения: 1')).toBeInTheDocument();
    expect(dropArea?.className).toContain('p-3');
    expect(within(dialog).getByRole('button', { name: 'Отмена' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Добавить заметку' })).toBeEnabled();
  });
});
