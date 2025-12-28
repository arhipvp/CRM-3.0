import React, { useEffect, useMemo, useState } from 'react';
import { FileUploadManager } from '../FileUploadManager';
import { ColoredLabel } from '../common/ColoredLabel';
import {
  askKnowledgeBase,
  deleteKnowledgeAnswer,
  fetchInsuranceTypes,
  fetchSavedAnswers,
  saveKnowledgeAnswer,
} from '../../api';
import {
  InsuranceType,
  KnowledgeCitation,
  KnowledgeDocument,
  KnowledgeSavedAnswer,
} from '../../types';

const formatDate = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleDateString('ru-RU');
};

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
    metadata: { title?: string; description?: string; insuranceTypeId?: string }
  ) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onSync: (documentId: string) => Promise<void>;
  disabled?: boolean;
}

export const KnowledgeDocumentsView: React.FC<KnowledgeDocumentsViewProps> = ({
  documents,
  isLoading,
  error,
  onUpload,
  onDelete,
  onSync,
  disabled,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [insuranceTypes, setInsuranceTypes] = useState<InsuranceType[]>([]);
  const [selectedInsuranceTypeId, setSelectedInsuranceTypeId] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [question, setQuestion] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<KnowledgeCitation[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [savedAnswers, setSavedAnswers] = useState<KnowledgeSavedAnswer[]>([]);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const resolveSyncStatus = (doc: KnowledgeDocument) => {
    const status = (doc.openNotebookStatus || '').trim().toLowerCase();
    if (status === 'synced') {
      return { label: 'Синхронизирован', tone: 'success' as const };
    }
    if (status === 'queued' || status === 'running' || status === 'new') {
      return { label: 'В обработке', tone: 'pending' as const };
    }
    if (status === 'error' || status === 'failed') {
      return { label: 'Ошибка синхронизации', tone: 'error' as const };
    }
    if (status === 'disabled') {
      return { label: 'Синхронизация выключена', tone: 'muted' as const };
    }
    if (doc.openNotebookSourceId) {
      return { label: 'Синхронизирован', tone: 'success' as const };
    }
    return { label: 'Ожидает синхронизации', tone: 'pending' as const };
  };

  const resolveSyncBadgeClass = (tone: 'success' | 'error' | 'muted' | 'pending') => {
    if (tone === 'success') {
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    }
    if (tone === 'error') {
      return 'border-rose-200 bg-rose-50 text-rose-700';
    }
    if (tone === 'muted') {
      return 'border-slate-200 bg-slate-100 text-slate-600';
    }
    return 'border-amber-200 bg-amber-50 text-amber-700';
  };

  const sorted = useMemo(
    () =>
      [...documents].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [documents]
  );

  useEffect(() => {
    let isMounted = true;
    fetchInsuranceTypes()
      .then((types) => {
        if (!isMounted) {
          return;
        }
        setInsuranceTypes(types);
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Не удалось загрузить виды страхования';
        setLocalError(message);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedInsuranceTypeId && insuranceTypes.length > 0) {
      setSelectedInsuranceTypeId(insuranceTypes[0].id);
    }
  }, [insuranceTypes, selectedInsuranceTypeId]);

  useEffect(() => {
    setAnswer('');
    setAskError(null);
    setCitations([]);
    setSavedError(null);
  }, [selectedInsuranceTypeId]);

  useEffect(() => {
    if (!selectedInsuranceTypeId) {
      setSavedAnswers([]);
      return;
    }
    let isMounted = true;
    fetchSavedAnswers(selectedInsuranceTypeId)
      .then((items) => {
        if (!isMounted) {
          return;
        }
        setSavedAnswers(items);
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'Не удалось загрузить сохранённые ответы';
        setSavedError(message);
      });
    return () => {
      isMounted = false;
    };
  }, [selectedInsuranceTypeId]);

  const filtered = useMemo(
    () =>
      selectedInsuranceTypeId
        ? sorted.filter((doc) => doc.insuranceTypeId === selectedInsuranceTypeId)
        : [],
    [sorted, selectedInsuranceTypeId]
  );

  const handleUpload = async (file: File) => {
    if (!selectedInsuranceTypeId) {
      setLocalError('Выберите вид страхования перед загрузкой.');
      return;
    }
    await onUpload(file, {
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      insuranceTypeId: selectedInsuranceTypeId,
    });
    setTitle('');
    setDescription('');
    setLocalError(null);
  };

  const handleAsk = async () => {
    if (!selectedInsuranceTypeId) {
      setAskError('Выберите вид страхования для вопроса.');
      return;
    }
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion) {
      setAskError('Введите вопрос.');
      return;
    }
    setIsAsking(true);
    setAskError(null);
    try {
      const response = await askKnowledgeBase(
        selectedInsuranceTypeId,
        trimmedQuestion
      );
      setAnswer(response.answer);
      setCitations(response.citations ?? []);
      setLastQuestion(trimmedQuestion);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Ошибка запроса к базе знаний';
      setAskError(message);
    } finally {
      setIsAsking(false);
    }
  };

  const handleDelete = async (doc: KnowledgeDocument) => {
    if (disabled || deletingId) {
      return;
    }
    const confirmed = window.confirm(
      `Удалить документ "${doc.title}"? Он будет удален и из Open Notebook.`
    );
    if (!confirmed) {
      return;
    }
    setDeletingId(doc.id);
    setLocalError(null);
    try {
      await onDelete(doc.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Ошибка при удалении документа';
      setLocalError(message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSync = async (doc: KnowledgeDocument) => {
    if (disabled || syncingId) {
      return;
    }
    setSyncingId(doc.id);
    setLocalError(null);
    try {
      await onSync(doc.id);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Ошибка при синхронизации документа';
      setLocalError(message);
    } finally {
      setSyncingId(null);
    }
  };

  const handleSaveAnswer = async () => {
    if (!selectedInsuranceTypeId) {
      setSavedError('Выберите вид страхования для сохранения ответа.');
      return;
    }
    if (!answer.trim()) {
      setSavedError('Нет ответа для сохранения.');
      return;
    }
    if (!lastQuestion.trim()) {
      setSavedError('Не найден вопрос для сохранения.');
      return;
    }
    setSavingAnswer(true);
    setSavedError(null);
    try {
      const saved = await saveKnowledgeAnswer({
        insuranceTypeId: selectedInsuranceTypeId,
        question: lastQuestion,
        answer,
        citations,
      });
      setSavedAnswers((prev) => [saved, ...prev]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось сохранить ответ.';
      setSavedError(message);
    } finally {
      setSavingAnswer(false);
    }
  };

  const handleDeleteSavedAnswer = async (answerId: string) => {
    if (disabled) {
      return;
    }
    try {
      await deleteKnowledgeAnswer(answerId);
      setSavedAnswers((prev) => prev.filter((item) => item.id !== answerId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось удалить сохранённый ответ.';
      setSavedError(message);
    }
  };

  const renderAnswerWithCitations = (
    text: string,
    sourceCitations: KnowledgeCitation[]
  ) => {
    if (!sourceCitations.length) {
      return text;
    }
    const indexBySource = new Map(
      sourceCitations.map((item, index) => [item.sourceId, index + 1])
    );
    const parts: Array<string | React.ReactNode> = [];
    const regex = /\[source:([^\]]+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null = regex.exec(text);
    let key = 0;
    while (match) {
      const start = match.index;
      const end = regex.lastIndex;
      parts.push(text.slice(lastIndex, start));
      const sourceId = match[1];
      const number = indexBySource.get(sourceId);
      if (number) {
        parts.push(
          <sup key={`cite-${key}`}>[{number}]</sup>
        );
        key += 1;
      }
      lastIndex = end;
      match = regex.exec(text);
    }
    parts.push(text.slice(lastIndex));
    return parts;
  };

  return (
    <div className="space-y-6 px-6 py-6">
      <section className="app-panel space-y-6 p-6 shadow-none">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Библиотека полезной документации</h2>
          <p className="text-sm text-slate-500 mt-1">
            Загружайте правила, методички и другие PDF-файлы — они будут храниться
            локально на сервере и доступны всей команде.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-1 text-sm text-slate-600">
            Вид страхования
            <select
              value={selectedInsuranceTypeId}
              onChange={(event) => {
                setSelectedInsuranceTypeId(event.target.value);
                setLocalError(null);
              }}
              className="field field-input"
              disabled={disabled || insuranceTypes.length === 0}
            >
              <option value="">Выберите вид страхования</option>
              {insuranceTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.name}
                </option>
              ))}
            </select>
          </label>
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

        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Задать вопрос</h3>
            <p className="text-xs text-slate-500">
              Вопрос будет задан только внутри выбранного вида страхования.
            </p>
          </div>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Например: Какие исключения есть в правилах страхования?"
            rows={3}
            className="field field-input"
            disabled={isAsking || disabled}
          />
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary btn-sm rounded-xl"
              onClick={handleAsk}
              disabled={isAsking || disabled}
            >
              {isAsking ? 'Отвечаем...' : 'Спросить'}
            </button>
            {askError && <span className="text-xs text-rose-600">{askError}</span>}
          </div>
          {answer && (
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700 whitespace-pre-line space-y-3">
              <div>{renderAnswerWithCitations(answer, citations)}</div>
              {citations.length > 0 && (
                <div className="border-t border-slate-100 pt-2 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-700">Источники</div>
                  {citations.map((item, index) => (
                    <div key={item.sourceId} className="flex flex-wrap gap-2">
                      <span className="text-slate-500">[{index + 1}]</span>
                      {item.fileUrl ? (
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <span>{item.title}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm rounded-xl"
                  onClick={handleSaveAnswer}
                  disabled={savingAnswer || disabled}
                >
                  {savingAnswer ? 'Сохраняем...' : 'Сохранить ответ'}
                </button>
                {savedError && (
                  <span className="text-xs text-rose-600">{savedError}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {localError && <div className="app-alert app-alert-danger">{localError}</div>}
        {error && <div className="app-alert app-alert-danger">{error}</div>}
      </section>

      <section className="app-panel shadow-none">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Сохраненные документы</h3>
              <p className="text-xs text-slate-500">
                {filtered.length} файл{filtered.length === 1 ? "" : "ов"}
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
          {filtered.length === 0 && !isLoading && (
            <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">
              Пока нет загруженных документов.
            </div>
          )}
          {filtered.map((doc) => (
            <div
              key={doc.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 shadow-sm"
            >
              {(() => {
                const syncStatus = resolveSyncStatus(doc);
                return (
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-slate-500">Синхронизация:</span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-semibold ${resolveSyncBadgeClass(
                        syncStatus.tone
                      )}`}
                    >
                      {syncStatus.label}
                    </span>
                  </div>
                );
              })()}
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
                  Автор:{" "}
                  <ColoredLabel
                    value={doc.ownerUsername}
                    fallback="—"
                    showDot={false}
                    className="text-xs text-slate-500"
                  />
                  {doc.ownerId ? ` (${doc.ownerId})` : ''}
                </span>
                <span>Тип: {doc.mimeType || "—"}</span>
                <span>Вид: {doc.insuranceTypeName || "—"}</span>
              </div>
              {doc.openNotebookStatus === 'error' && doc.openNotebookError && (
                <div className="text-xs text-rose-600">
                  {doc.openNotebookError}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                {doc.fileUrl ? (
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm rounded-xl"
                  >
                    Открыть файл
                  </a>
                ) : doc.webViewLink ? (
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
                <button
                  type="button"
                  className="btn btn-secondary btn-sm rounded-xl"
                  onClick={() => handleSync(doc)}
                  disabled={disabled || syncingId === doc.id}
                >
                  {syncingId === doc.id ? 'Синхронизация...' : 'Синхронизировать'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm rounded-xl"
                  onClick={() => handleDelete(doc)}
                  disabled={disabled || deletingId === doc.id}
                >
                  {deletingId === doc.id ? 'Удаляем...' : 'Удалить'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel shadow-none">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Сохранённые ответы</h3>
              <p className="text-xs text-slate-500">
                {savedAnswers.length} ответ{savedAnswers.length === 1 ? '' : 'ов'}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-4">
          {savedError && (
            <div className="app-alert app-alert-danger">{savedError}</div>
          )}
          {savedAnswers.length === 0 && (
            <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">
              Пока нет сохранённых ответов.
            </div>
          )}
          {savedAnswers.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 shadow-sm"
            >
              <div className="text-xs text-slate-500">
                {formatDate(item.createdAt)}
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {item.question}
              </div>
              <div className="text-sm text-slate-700 whitespace-pre-line">
                {renderAnswerWithCitations(item.answer, item.citations)}
              </div>
              {item.citations.length > 0 && (
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-700">Источники</div>
                  {item.citations.map((cite, index) => (
                    <div key={`${item.id}-${cite.sourceId}`} className="flex flex-wrap gap-2">
                      <span className="text-slate-500">[{index + 1}]</span>
                      {cite.fileUrl ? (
                        <a
                          href={cite.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {cite.title}
                        </a>
                      ) : (
                        <span>{cite.title}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="btn btn-danger btn-sm rounded-xl"
                  onClick={() => handleDeleteSavedAnswer(item.id)}
                  disabled={disabled}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};
