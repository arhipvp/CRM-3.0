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
}) => {
  const renderStatusMessage = (message: string, tone: 'default' | 'danger' = 'default') => {
    const className =
      tone === 'danger'
        ? 'app-alert app-alert-danger'
        : 'app-panel-muted px-4 py-3 text-sm text-slate-600';

    return <div className={className}>{message}</div>;
  };

  return (
    <section className="app-panel p-6 shadow-none space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="app-label">Заметки</p>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                disabled={notesLoading}
                onClick={() => onSetFilter(option.value)}
                className={`btn btn-sm rounded-full ${
                  notesFilter === option.value ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {notesError && renderStatusMessage(notesError, 'danger')}

      {notesFilter === 'active' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <textarea
            rows={4}
            value={noteDraft}
            onChange={(event) => onSetDraft(event.target.value)}
            placeholder="Заметка к сделке"
            className="field-textarea"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500">Все заметки видны всем участникам</p>
            <button
              type="button"
              onClick={onAddNote}
              disabled={notesAction === 'create'}
              className="btn btn-primary btn-sm rounded-xl"
            >
              {notesAction === 'create' ? 'Добавляем...' : 'Добавить заметку'}
            </button>
          </div>
        </div>
      )}

      {notesLoading ? (
        <div className="app-panel-muted p-4">
          <div className="space-y-3 animate-pulse">
            <div className="h-3 w-1/3 rounded bg-slate-200" />
            <div className="h-3 w-2/3 rounded bg-slate-200" />
            <div className="h-3 w-1/2 rounded bg-slate-200" />
          </div>
        </div>
      ) : notes.length ? (
        <div className="columns-1 gap-4 space-y-4 sm:columns-2 xl:columns-3 2xl:columns-4">
          {notes.map((note) => (
            <article
              key={note.id}
              className="relative mb-4 break-inside-avoid-column overflow-hidden rounded-[28px] border border-amber-200 bg-amber-50 p-4 pb-5 text-slate-900 shadow-[0_20px_40px_rgba(245,158,11,0.25)] transition hover:-translate-y-1"
            >
              <div className="absolute right-4 top-2 h-3 w-12 rounded-full bg-amber-300 opacity-80 shadow-[0_4px_15px_rgba(245,158,11,0.5)]" />
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
                    {notesAction === note.id ? 'Восстанавливаем...' : 'Восстановить'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        renderStatusMessage('Заметок не найдено.')
      )}
    </section>
  );
};
