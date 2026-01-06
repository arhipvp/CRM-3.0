import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useDealNotes } from '../hooks/useDealNotes';
import type { Note } from '../../../../types';

vi.mock('../../../../api', () => ({
  fetchDealNotes: vi.fn(),
  createNote: vi.fn(),
  archiveNote: vi.fn(),
  restoreNote: vi.fn(),
  uploadDealDriveFile: vi.fn(),
  trashDealDriveFiles: vi.fn(),
}));

import { fetchDealNotes, createNote } from '../../../../api';
const fetchDealNotesMock = vi.mocked(fetchDealNotes);
const createNoteMock = vi.mocked(createNote);

const renderDealNotesHook = (dealId?: string) => {
  const resultRef: { current: ReturnType<typeof useDealNotes> | null } = {
    current: null,
  };

  const Wrapper: React.FC<{ dealId?: string }> = ({ dealId }) => {
    const state = useDealNotes(dealId);
    useEffect(() => {
      resultRef.current = state;
    }, [state]);
    return null;
  };

  const utils = render(<Wrapper dealId={dealId} />);
  return { ...utils, resultRef };
};

describe('useDealNotes', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads notes and re-fetches when the filter changes', async () => {
    const initialNotes: Note[] = [
      {
        id: 'note-1',
        dealId: 'deal-1',
        body: 'Initial note',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ];
    fetchDealNotesMock.mockResolvedValueOnce(initialNotes);

    const { resultRef } = renderDealNotesHook('deal-1');

    await waitFor(() => {
      expect(fetchDealNotesMock).toHaveBeenCalledWith('deal-1', false);
    });

    await waitFor(() => {
      expect(resultRef.current?.notes).toEqual(initialNotes);
    });

    act(() => {
      resultRef.current?.setNotesFilter('archived');
    });

    await waitFor(() => {
      expect(fetchDealNotesMock).toHaveBeenCalledWith('deal-1', true);
    });
  });

  it('adds a note and reloads the list', async () => {
    const firstBatch: Note[] = [
      {
        id: 'note-1',
        dealId: 'deal-1',
        body: 'First',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
      },
    ];
    const secondBatch: Note[] = [
      ...firstBatch,
      {
        id: 'note-2',
        dealId: 'deal-1',
        body: 'Second',
        createdAt: '2025-01-02T00:00:00Z',
        updatedAt: '2025-01-02T00:00:00Z',
      },
    ];

    fetchDealNotesMock.mockResolvedValueOnce(firstBatch).mockResolvedValueOnce(secondBatch);
    createNoteMock.mockResolvedValueOnce({
      id: 'note-3',
      dealId: 'deal-1',
      body: 'New note',
      createdAt: '2025-01-03T00:00:00Z',
      updatedAt: '2025-01-03T00:00:00Z',
    } as Note);

    const { resultRef } = renderDealNotesHook('deal-1');

    await waitFor(() => expect(fetchDealNotes).toHaveBeenCalled());

    act(() => {
      resultRef.current?.setNoteDraft('  New note  ');
    });

    await act(async () => {
      await resultRef.current?.addNote();
    });

    expect(createNoteMock).toHaveBeenCalledWith('deal-1', 'New note', []);
    await waitFor(() => expect(fetchDealNotes).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(resultRef.current?.noteDraft).toBe(''));
  });
});
