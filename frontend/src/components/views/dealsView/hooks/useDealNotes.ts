import { useCallback, useEffect, useRef, useState } from 'react';

import type { Note } from '../../../../types';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import {
  fetchDealNotes,
  createNote,
  archiveNote as archiveNoteApi,
  restoreNote as restoreNoteApi,
} from '../../../../api';

type NotesFilter = 'active' | 'archived';

export const useDealNotes = (dealId?: string | null) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesFilter, setNotesFilter] = useState<NotesFilter>('active');
  const [noteDraft, setNoteDraft] = useState('');
  const [notesError, setNotesError] = useState<string | null>(null);
  const [notesAction, setNotesAction] = useState<string | null>(null);
  const latestDealIdRef = useRef<string | null | undefined>(dealId);

  useEffect(() => {
    latestDealIdRef.current = dealId;
    if (!dealId) {
      setNotes([]);
      setNotesLoading(false);
    }
  }, [dealId]);

  const loadNotes = useCallback(
    async (filter: NotesFilter) => {
      const currentDealId = dealId;
      if (!currentDealId) {
        setNotes([]);
        return;
      }
      setNotesLoading(true);
      setNotesError(null);
      try {
        const fetchedNotes = await fetchDealNotes(currentDealId, filter === 'archived');
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        setNotes(fetchedNotes);
      } catch (err) {
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        console.error('Ошибка загрузки заметок:', err);
        setNotesError(formatErrorMessage(err, 'Не удалось загрузить заметки'));
      } finally {
        if (latestDealIdRef.current === currentDealId) {
          setNotesLoading(false);
        }
      }
    },
    [dealId]
  );

  useEffect(() => {
    if (!dealId) {
      setNotes([]);
      setNotesLoading(false);
      return;
    }
    void loadNotes(notesFilter);
  }, [dealId, loadNotes, notesFilter]);

  const addNote = useCallback(async () => {
    const currentDealId = dealId;
    if (!currentDealId) {
      return;
    }

    const trimmed = noteDraft.trim();
    if (!trimmed) {
      return;
    }

    setNotesAction('create');
    setNotesError(null);
    try {
      await createNote(currentDealId, trimmed);
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      setNoteDraft('');
      await loadNotes(notesFilter);
    } catch (err) {
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      console.error('Ошибка создания заметки:', err);
      setNotesError(formatErrorMessage(err, 'Не удалось создать заметку'));
    } finally {
      if (latestDealIdRef.current === currentDealId) {
        setNotesAction(null);
      }
    }
  }, [dealId, noteDraft, loadNotes, notesFilter]);

  const archiveNote = useCallback(
    async (noteId: string) => {
      const currentDealId = dealId;
      if (!currentDealId) {
        return;
      }

      setNotesAction(noteId);
      setNotesError(null);
      try {
        await archiveNoteApi(noteId);
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        await loadNotes(notesFilter);
      } catch (err) {
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        console.error('Ошибка удаления заметки:', err);
        setNotesError(formatErrorMessage(err, 'Не удалось удалить заметку'));
      } finally {
        if (latestDealIdRef.current === currentDealId) {
          setNotesAction(null);
        }
      }
    },
    [dealId, loadNotes, notesFilter]
  );

  const restoreNote = useCallback(
    async (noteId: string) => {
      const currentDealId = dealId;
      if (!currentDealId) {
        return;
      }

      setNotesAction(noteId);
      setNotesError(null);
      try {
        await restoreNoteApi(noteId);
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        setNotesFilter('active');
      } catch (err) {
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        console.error('Ошибка восстановления заметки:', err);
        setNotesError(formatErrorMessage(err, 'Не удалось восстановить заметку'));
      } finally {
        if (latestDealIdRef.current === currentDealId) {
          setNotesAction(null);
        }
      }
    },
    [dealId]
  );

  return {
    notes,
    notesLoading,
    notesFilter,
    noteDraft,
    notesError,
    notesAction,
    setNoteDraft,
    setNotesFilter,
    addNote,
    archiveNote,
    restoreNote,
  };
};
