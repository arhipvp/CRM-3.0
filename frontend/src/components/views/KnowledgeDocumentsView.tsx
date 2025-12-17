import React, { useMemo, useState } from 'react';
import { FileUploadManager } from '../FileUploadManager';
import { ColoredLabel } from '../common/ColoredLabel';
import { KnowledgeDocument } from '../../types';

const formatDate = (value?: string | null): string =>
  value ? new Date(value).toLocaleDateString('ru-RU') : '—';

const formatSize = (value?: number | null): string => {
  if (!value || value <= 0) {
    return '—';
  }
  const units = ['Б', 'КБ', 'МБ', 'ГБ'];
  let size = value;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`;
};

interface KnowledgeDocumentsViewProps {
  documents: KnowledgeDocument[];
  isLoading: boolean;
  error?: string | null;
  onUpload: (
    file: File,
    metadata: { title?: string; description?: string }
  ) => Promise<void>;
  disabled?: boolean;
}

export const KnowledgeDocumentsView: React.FC<KnowledgeDocumentsViewProps> = ({
  documents,
  isLoading,
  error,
  onUpload,
  disabled,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const sorted = useMemo(
    () =>
      [...documents].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [documents]
  );

  const handleUpload = async (file: File) => {
    await onUpload(file, {
      title: title.trim() || undefined,
      description: description.trim() || undefined,
    });
    setTitle('');
    setDescription('');
  };

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="app-panel space-y-6 p-6 shadow-none">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Библиотека полезной документации</h2>
          <p className="text-sm text-slate-500 mt-1">
            Загрузите правила, методички и другие PDF-файлы - они попадут в общий доступ и будут
            храниться на вашем Google Drive.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1 text-sm text-slate-600">
            Заголовок (пояснение)
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Имя или признак документа"
              className="field field-input"
              disabled={disabled}
            />
          </label>
          <label className="block space-y-1 text-sm text-slate-600">
            Описание
            <input
              type="text"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Краткое описание содержания"
              className="field field-input"
              disabled={disabled}
            />
          </label>
        </div>

        <FileUploadManager onUpload={handleUpload} disabled={disabled} />

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
      </section>

      <section className="app-panel shadow-none">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Сохраненные документы</h3>
              <p className="text-xs text-slate-500">
                {documents.length} файл{documents.length === 1 ? '' : 'ов'}
              </p>
            </div>
            {isLoading && (
              <span className="text-xs uppercase tracking-wide text-slate-400">
                Загрузка...
              </span>
            )}
          </div>
        </div>

        <div className="p-6 space-y-4">
          {sorted.length === 0 && !isLoading && (
            <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">
              Пока нет загруженных документов.
            </div>
          )}
          {sorted.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">{doc.title}</p>
                  <p className="text-[13px] text-slate-500">{doc.fileName}</p>
                </div>
                <span className="text-xs text-slate-500">{formatSize(doc.fileSize)}</span>
              </div>
              {doc.description && (
                <p className="text-sm text-slate-600">{doc.description}</p>
              )}
              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                <span>Залит: {formatDate(doc.createdAt)}</span>
                <span>
                  Автор:{' '}
                  <ColoredLabel
                    value={doc.ownerUsername}
                    fallback="—"
                    showDot={false}
                    className="text-xs text-slate-500"
                  />
                  {doc.ownerId ? ` (${doc.ownerId})` : ''}
                </span>
                <span>Тип: {doc.mimeType || '—'}</span>
              </div>
              {doc.webViewLink ? (
                <a
                  href={doc.webViewLink}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary btn-sm rounded-xl"
                >
                  Открыть на Drive
                </a>
              ) : (
                <span className="text-xs text-slate-400">Ссылка недоступна</span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
