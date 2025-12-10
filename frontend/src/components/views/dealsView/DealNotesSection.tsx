import React from 'react';

import type { Note } from '../../../types';
import { formatDate } from './helpers';
import { ColoredLabel } from '../../common/ColoredLabel';

interface DealNotesSectionProps {
  notes: Note[];
  notesLoading: boolean;
  notesFilter: 'active' | 'archived';
  noteDraft: string;
  notesError: string | null;
  notesAction: string | null;
  onSetFilter: (filter: 'active' | 'archived') => void;
  onSetDraft: (value: string) => void;
  onAddNote: () => void;
  onArchiveNote: (noteId: string) => void;
  onRestoreNote: (noteId: string) => void;
}

const filterOptions: { value: 'active' | 'archived'; label: string }[] = [
  { value: 'active', label: 'Активные' },
  { value: 'archived', label: 'Показать удаленные заметки' },
];

export const DealNotesSection: React.FC<DealNotesSectionProps> = ({
  notes,
  notesLoading,
  notesFilter,
  noteDraft,
  notesError,
  notesAction,
  onSetFilter,
  onSetDraft,
  onAddNote,
  onArchiveNote,
  onRestoreNote,
}) => (
  <section className="space-y-6">
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            disabled={notesLoading}
            onClick={() => onSetFilter(option.value)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              notesFilter === option.value
                ? 'bg-slate-900 text-white border border-slate-900'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {notesError && <p className="text-xs text-rose-500">{notesError}</p>}
      {notesFilter === 'active' && (
        <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm">
          <textarea
            rows={4}
            value={noteDraft}
            onChange={(event) => onSetDraft(event.target.value)}
            placeholder="Заметка к сделке"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm leading-relaxed text-slate-900 shadow-inner focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-400">Все заметки видны всем участникам</p>
            <button
              type="button"
              onClick={onAddNote}
              disabled={notesAction === 'create'}
              className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {notesAction === 'create' ? 'Сохраняем...' : 'Добавить заметку'}
            </button>
          </div>
        </div>
      )}
    </div>

    {notesLoading ? (
      <p className="text-sm text-slate-500">Загрузка заметок...</p>
    ) : notes.length ? (
      <div className="columns-1 gap-4 space-y-4 sm:columns-2 xl:columns-3 2xl:columns-4">
        {notes.map((note) => (
          <article
            key={note.id}
            className="relative mb-4 overflow-hidden rounded-[28px] border border-amber-200 bg-amber-50 p-4 pb-5 text-slate-900 shadow-[0_20px_40px_rgba(245,158,11,0.25)] transition hover:-translate-y-1 break-inside-avoid-column"
          >
            <div className="absolute top-2 right-4 h-3 w-12 rounded-full bg-amber-300 opacity-80 shadow-[0_4px_15px_rgba(245,158,11,0.5)]" />
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
              <ColoredLabel
                value={note.authorName}
                fallback="—"
                showDot={false}
                className="text-[11px] uppercase tracking-[0.3em]"
              />
            </p>
            <p className="mt-3 whitespace-pre-line break-words text-sm leading-relaxed text-slate-900">
              {note.body || '—'}
            </p>
            <div className="mt-4 flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              <span className="text-[11px] font-normal text-slate-500">
                {formatDate(note.createdAt)}
              </span>
              {notesFilter === 'active' ? (
                <button
                  type="button"
                  disabled={notesAction === note.id}
                  onClick={() => onArchiveNote(note.id)}
                  className="text-[11px] font-semibold text-slate-700 transition hover:text-slate-900 disabled:text-slate-400"
                >
                  {notesAction === note.id ? 'Удаляем...' : 'Удалить'}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={notesAction === note.id}
                  onClick={() => onRestoreNote(note.id)}
                  className="text-[11px] font-semibold text-slate-700 transition hover:text-slate-900 disabled:text-slate-400"
                >
                  {notesAction === note.id ? 'Сохраняем...' : 'Восстановить'}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    ) : (
      <p className="text-sm text-slate-500">Заметок не найдено.</p>
    )}
  </section>
);
