import { useRef, useState } from "react";
import type { DocumentItem } from "../types";

const ACCEPTED =
  ".pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.html,.htm,.eml,.msg,.jpg,.jpeg,.png,.tiff,.tif";

const STATUS: Record<DocumentItem["status"], string> = {
  queued: "В очереди",
  indexing: "Индексируется",
  ready: "Готов",
  failed: "Ошибка",
};

function formatSize(size?: number) {
  if (!size) return "";
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} КБ`
    : `${(size / 1024 / 1024).toFixed(1)} МБ`;
}

interface Props {
  documents: DocumentItem[];
  busy: boolean;
  onUpload(files: File[]): void;
  onDelete(document: DocumentItem): void;
}

export function DocumentLibrary({
  documents,
  busy,
  onUpload,
  onDelete,
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const receive = (files: FileList | null) => {
    const allowed = Array.from(files ?? []).filter((file) =>
      /\.(pdf|docx|xlsx|pptx|txt|md|csv|html?|eml|msg|jpe?g|png|tiff?)$/i.test(
        file.name,
      ),
    );
    if (allowed.length) onUpload(allowed);
  };

  return (
    <section className="library" aria-label="Библиотека источников">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Источники</p>
          <h2>Библиотека</h2>
        </div>
        <span className="counter">
          {documents.filter((doc) => doc.status === "ready").length}
        </span>
      </div>
      <button
        className={`dropzone ${dragging ? "dropzone-active" : ""}`}
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          receive(event.dataTransfer.files);
        }}
      >
        <span className="drop-icon">↑</span>
        <strong>Добавить документы</strong>
        <small>Перетащите файлы или выберите на компьютере</small>
      </button>
      <input
        ref={input}
        className="sr-only"
        type="file"
        multiple
        accept={ACCEPTED}
        onChange={(event) => receive(event.target.files)}
      />
      {busy && <p className="upload-status">Загружаем и ставим в очередь…</p>}
      <div className="document-list">
        {documents.length === 0 ? (
          <p className="empty-documents">
            Здесь появятся правила, тарифы и шаблоны. Пока в библиотеке пусто.
          </p>
        ) : (
          documents.map((document) => (
            <article className="document-row" key={document.id}>
              <span className="file-badge">
                {document.filename
                  .split(".")
                  .pop()
                  ?.slice(0, 4)
                  .toUpperCase() ?? "ФАЙЛ"}
              </span>
              <div className="document-meta">
                <strong title={document.filename}>{document.filename}</strong>
                <span>
                  {STATUS[document.status]}
                  {document.size ? ` · ${formatSize(document.size)}` : ""}
                </span>
                {document.error && (
                  <span className="error-text">{document.error}</span>
                )}
              </div>
              <button
                className="icon-button"
                type="button"
                onClick={() => onDelete(document)}
                aria-label={`Удалить ${document.filename}`}
                title="Удалить"
              >
                ×
              </button>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
