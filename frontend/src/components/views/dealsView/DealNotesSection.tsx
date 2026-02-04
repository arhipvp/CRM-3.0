import { useEffect, useState } from 'react';

import type { DriveFile, Note } from '../../../types';
import { downloadDealDriveFiles } from '../../../api';
import { API_BASE, requestBlob } from '../../../api/request';
import { formatDate } from './helpers';
import { ColoredLabel } from '../../common/ColoredLabel';
import { FileUploadManager } from '../../FileUploadManager';
import { Modal } from '../../Modal';
import { dedupeFiles } from '../../../utils/fileUpload';

const attachmentImageCache = new Map<string, string>();
const attachmentImagePromises = new Map<string, Promise<string>>();
const draftAttachmentImageCache = new Map<string, string>();
const draftAttachmentImagePromises = new Map<string, Promise<string>>();

const getAttachmentCacheKey = (noteId: string, fileId: string) => `${noteId}:${fileId}`;
const getDraftAttachmentCacheKey = (fileId: string) => `draft:${fileId}`;

interface DealNotesSectionProps {
  dealId?: string | null;
  notes: Note[];
  notesLoading: boolean;
  notesFilter: 'active' | 'archived';
  noteDraft: string;
  noteIsImportant: boolean;
  notesError: string | null;
  notesAction: string | null;
  noteAttachments: DriveFile[];
  noteAttachmentsUploading: boolean;
  onSetFilter: (filter: 'active' | 'archived') => void;
  onSetDraft: (value: string) => void;
  onToggleImportant: (value: boolean) => void;
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
  dealId,
  notes,
  notesLoading,
  notesFilter,
  noteDraft,
  noteIsImportant,
  notesError,
  notesAction,
  noteAttachments,
  noteAttachmentsUploading,
  onSetFilter,
  onSetDraft,
  onToggleImportant,
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
    tone,
  }: {
    noteId: string;
    file: DriveFile;
    onOpen: (payload: { src: string; name: string }) => void;
    tone: 'default' | 'important';
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
          console.error('Ошибка загрузки изображения заметки:', error);
          setHasError(true);
        }
      };

      loadImage();

      return () => {
        isActive = false;
      };
    }, [file.id, noteId]);

    if (hasError) {
      const errorClassName =
        tone === 'important'
          ? 'flex h-24 items-center justify-center rounded-xl border border-rose-200 bg-white text-[10px] text-slate-500'
          : 'flex h-24 items-center justify-center rounded-xl border border-amber-200 bg-white text-[10px] text-slate-500';
      return <div className={errorClassName}>Не удалось загрузить</div>;
    }

    const buttonClassName =
      tone === 'important'
        ? 'group inline-block overflow-hidden rounded-xl border border-rose-200 bg-white text-left shadow-sm'
        : 'group inline-block overflow-hidden rounded-xl border border-amber-200 bg-white text-left shadow-sm';

    return (
      <button
        type="button"
        className={buttonClassName}
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

  const DraftAttachmentImage = ({
    dealId,
    file,
    onOpen,
  }: {
    dealId: string | null;
    file: DriveFile;
    onOpen: (payload: { src: string; name: string }) => void;
  }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
      if (!dealId) {
        return;
      }
      let isActive = true;
      const cacheKey = getDraftAttachmentCacheKey(file.id);
      const cachedUrl = draftAttachmentImageCache.get(cacheKey);

      if (cachedUrl) {
        setSrc(cachedUrl);
        return () => {
          isActive = false;
        };
      }

      const loadImage = async () => {
        try {
          let pending = draftAttachmentImagePromises.get(cacheKey);
          if (!pending) {
            pending = downloadDealDriveFiles(dealId, [file.id]).then(({ blob }) => {
              const objectUrl = URL.createObjectURL(blob);
              draftAttachmentImageCache.set(cacheKey, objectUrl);
              draftAttachmentImagePromises.delete(cacheKey);
              return objectUrl;
            });
            draftAttachmentImagePromises.set(cacheKey, pending);
          }
          const objectUrl = await pending;
          if (isActive) {
            setSrc(objectUrl);
          }
        } catch (error) {
          if (!isActive) {
            return;
          }
          console.error('Ошибка загрузки изображения заметки:', error);
          setHasError(true);
        }
      };

      loadImage();

      return () => {
        isActive = false;
      };
    }, [dealId, file.id]);

    if (hasError) {
      return (
        <div className="flex h-28 items-center justify-center rounded-xl border border-slate-200 bg-white text-[10px] text-slate-500">
          Не удалось загрузить
        </div>
      );
    }

    return (
      <button
        type="button"
        className="group relative overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-sm"
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
            className="h-28 w-28 object-cover transition duration-200 group-hover:scale-[1.02]"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="flex h-28 w-28 items-center justify-center text-[10px] text-slate-500">
            Загрузка...
          </div>
        )}
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
          <button
            type="button"
            onClick={() => setIsCreateModalOpen(true)}
            className="btn btn-primary btn-sm rounded-xl"
          >
            Добавить заметку
          </button>
        </div>

        {notesError && renderStatusMessage(notesError, 'danger')}

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
            {notes.map((note) => {
              const isImportant = Boolean(note.isImportant);
              const cardClassName = isImportant
                ? 'relative mb-4 break-inside-avoid-column overflow-hidden rounded-[28px] border border-rose-300 bg-rose-50 p-4 pb-5 text-slate-900 shadow-[0_20px_40px_rgba(244,63,94,0.2)] transition hover:-translate-y-1'
                : 'relative mb-4 break-inside-avoid-column overflow-hidden rounded-[28px] border border-amber-200 bg-amber-50 p-4 pb-5 text-slate-900 shadow-[0_20px_40px_rgba(245,158,11,0.25)] transition hover:-translate-y-1';
              const accentClassName = isImportant
                ? 'absolute right-4 top-2 h-3 w-12 rounded-full bg-rose-300 opacity-80 shadow-[0_4px_15px_rgba(244,63,94,0.5)]'
                : 'absolute right-4 top-2 h-3 w-12 rounded-full bg-amber-300 opacity-80 shadow-[0_4px_15px_rgba(245,158,11,0.5)]';
              const attachmentClassName = isImportant
                ? 'flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-2 py-2 text-xs text-slate-700 shadow-sm transition hover:bg-rose-100'
                : 'flex items-center gap-2 rounded-xl border border-amber-200 bg-white px-2 py-2 text-xs text-slate-700 shadow-sm transition hover:bg-amber-100';

              return (
                <article key={note.id} className={cardClassName}>
                  <div className={accentClassName} />
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
                                tone={isImportant ? 'important' : 'default'}
                              />
                            );
                          }
                          return (
                            <a
                              key={file.id}
                              href={href ?? previewUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={attachmentClassName}
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
              );
            })}
          </div>
        ) : (
          renderStatusMessage('Заметок не найдено.')
        )}
      </section>

      {isCreateModalOpen && (
        <Modal title="Новая заметка" onClose={() => setIsCreateModalOpen(false)} size="md">
          <div className="space-y-4">
            <textarea
              rows={5}
              value={noteDraft}
              onChange={(event) => onSetDraft(event.target.value)}
              onPaste={handleDraftPaste}
              placeholder="Заметка к сделке"
              className="field-textarea"
            />
            {noteAttachments.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Вложения: {noteAttachments.length}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  {noteAttachments.map((file) =>
                    isImageAttachment(file) ? (
                      <div key={file.id} className="relative">
                        <DraftAttachmentImage
                          dealId={dealId ?? null}
                          file={file}
                          onOpen={setImagePreview}
                        />
                        <button
                          type="button"
                          onClick={() => onRemoveNoteAttachment(file)}
                          className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white text-xs text-slate-500 shadow-sm transition hover:text-slate-700"
                          aria-label={`Удалить ${file.name}`}
                        >
                          x
                        </button>
                      </div>
                    ) : (
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
                    ),
                  )}
                </div>
              </div>
            )}
            <FileUploadManager
              onUpload={onAttachNoteFile}
              disabled={notesAction === 'create' || noteAttachmentsUploading}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  className="check"
                  checked={noteIsImportant}
                  onChange={(event) => onToggleImportant(event.target.checked)}
                  disabled={notesAction === 'create' || noteAttachmentsUploading}
                />
                <span>Важно</span>
              </label>
              <p className="text-xs text-slate-500">Все заметки видны всем участникам</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="btn btn-secondary btn-sm rounded-xl"
              >
                Отмена
              </button>
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
        </Modal>
      )}

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
