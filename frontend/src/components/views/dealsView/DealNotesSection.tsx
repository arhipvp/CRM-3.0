import { useEffect, useState } from 'react';

import type { DriveFile, Note } from '../../../types';
import { API_BASE, requestBlob } from '../../../api/request';
import { formatDate } from './helpers';
import { ColoredLabel } from '../../common/ColoredLabel';
import { FileUploadManager } from '../../FileUploadManager';
import { Modal } from '../../Modal';
import { dedupeFiles } from '../../../utils/fileUpload';

const attachmentImageCache = new Map<string, string>();
const attachmentImagePromises = new Map<string, Promise<string>>();

const getAttachmentCacheKey = (noteId: string, fileId: string) => `${noteId}:${fileId}`;

interface DealNotesSectionProps {
  notes: Note[];
  notesLoading: boolean;
  notesFilter: 'active' | 'archived';
  noteDraft: string;
  notesError: string | null;
  notesAction: string | null;
  noteAttachments: DriveFile[];
  noteAttachmentsUploading: boolean;
  onSetFilter: (filter: 'active' | 'archived') => void;
  onSetDraft: (value: string) => void;
  onAddNote: () => void;
  onAttachNoteFile: (file: File) => Promise<void>;
  onRemoveNoteAttachment: (file: DriveFile) => void;
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
  noteAttachments,
  noteAttachmentsUploading,
  onSetFilter,
  onSetDraft,
  onAddNote,
  onAttachNoteFile,
  onRemoveNoteAttachment,
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

  const buildAttachmentPath = (noteId: string, fileId: string) =>
    `/notes/${noteId}/attachments/${fileId}/download/`;

  const buildAttachmentUrl = (noteId: string, fileId: string) =>
    `${API_BASE}${buildAttachmentPath(noteId, fileId)}`;

  const isImageAttachment = (file: DriveFile) => file.mimeType?.startsWith('image/');

  const [imagePreview, setImagePreview] = useState<{ src: string; name: string } | null>(null);

  const handleDraftPaste = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (noteAttachmentsUploading || notesAction === 'create') {
      return;
    }

    const items = Array.from(event.clipboardData?.items ?? []);
    const filesFromItems = items
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    const filesFromList = Array.from(event.clipboardData?.files ?? []);
    const files = dedupeFiles(filesFromItems.length ? filesFromItems : filesFromList);

    if (!files.length) {
      return;
    }

    const clipboardText = event.clipboardData?.getData('text/plain');
    if (!clipboardText) {
      event.preventDefault();
    }
    for (const file of files) {
      await onAttachNoteFile(file);
    }
  };

  const NoteAttachmentImage = ({
    noteId,
    file,
    onOpen,
  }: {
    noteId: string;
    file: DriveFile;
    onOpen: (payload: { src: string; name: string }) => void;
  }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      let isActive = true;
      const cacheKey = getAttachmentCacheKey(noteId, file.id);
      const cachedUrl = attachmentImageCache.get(cacheKey);

      if (cachedUrl) {
        setSrc(cachedUrl);
        return () => {
          isActive = false;
        };
      }

      const loadImage = async () => {
        try {
          let pending = attachmentImagePromises.get(cacheKey);
          if (!pending) {
            pending = requestBlob(buildAttachmentPath(noteId, file.id)).then((blob) => {
              const objectUrl = URL.createObjectURL(blob);
              attachmentImageCache.set(cacheKey, objectUrl);
              attachmentImagePromises.delete(cacheKey);
              return objectUrl;
            });
            attachmentImagePromises.set(cacheKey, pending);
          }
          const objectUrl = await pending;
          if (isActive) {
            setSrc(objectUrl);
          }
        } catch (error) {
          if (!isActive) {
            return;
          }
          console.error(
            'РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РёР·РѕР±СЂР°Р¶РµРЅРёСЏ Р·Р°РјРµС‚РєРё:',
            error,
          );
          setHasError(true);
        }
      };

      loadImage();

      return () => {
        isActive = false;
      };
    }, [file.id, noteId]);

    if (hasError) {
      return (
        <div className="flex h-24 items-center justify-center rounded-xl border border-amber-200 bg-white text-[10px] text-slate-500">
          Не удалось загрузить
        </div>
      );
    }

    return (
      <button
        type="button"
        className="group inline-block overflow-hidden rounded-xl border border-amber-200 bg-white text-left shadow-sm"
        onClick={() => {
          if (src) {
            onOpen({ src, name: file.name });
          }
        }}
      >
        {src ? (
          <img
            src={src}
            alt={file.name}
            className="h-auto w-auto max-w-full transition duration-200 group-hover:scale-[1.01]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex min-h-[80px] min-w-[120px] items-center justify-center text-[10px] text-slate-500">
            Загрузка...
          </div>
        )}
        <div className="px-2 py-1 text-[10px] text-slate-600 truncate">{file.name}</div>
      </button>
    );
  };

  return (
    <>
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
              onPaste={handleDraftPaste}
              placeholder="Заметка к сделке"
              className="field-textarea"
            />
            {noteAttachments.length > 0 && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Вложения: {noteAttachments.length}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {noteAttachments.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs"
                    >
                      <span className="max-w-[180px] truncate text-slate-700">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => onRemoveNoteAttachment(file)}
                        className="text-slate-400 transition hover:text-slate-600"
                        aria-label={`Удалить ${file.name}`}
                      >
                        x
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4">
              <FileUploadManager
                onUpload={onAttachNoteFile}
                disabled={notesAction === 'create' || noteAttachmentsUploading}
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">Все заметки видны всем участникам</p>
              <button
                type="button"
                onClick={onAddNote}
                disabled={notesAction === 'create' || noteAttachmentsUploading}
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
                {note.attachments && note.attachments.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                      Вложения
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {note.attachments.map((file) => {
                        const previewUrl = buildAttachmentUrl(note.id, file.id);
                        const href = file.webViewLink || previewUrl;
                        if (isImageAttachment(file)) {
                          return (
                            <NoteAttachmentImage
                              key={file.id}
                              noteId={note.id}
                              file={file}
                              onOpen={setImagePreview}
                            />
                          );
                        }
                        return (
                          <a
                            key={file.id}
                            href={href ?? previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-2 py-2 text-xs text-slate-700 shadow-sm transition hover:bg-amber-100"
                          >
                            <span className="text-base">📎</span>
                            <span className="truncate">{file.name}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
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

      {imagePreview && (
        <Modal title={imagePreview.name} onClose={() => setImagePreview(null)} size="lg">
          <div className="flex justify-center">
            <img
              src={imagePreview.src}
              alt={imagePreview.name}
              className="max-h-[80vh] max-w-full h-auto w-auto"
            />
          </div>
        </Modal>
      )}
    </>
  );
};
