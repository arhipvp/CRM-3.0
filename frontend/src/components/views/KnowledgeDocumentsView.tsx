import React, { useEffect, useMemo, useState } from 'react';
import { FileUploadManager } from '../FileUploadManager';
import {
  askKnowledgeBase,
  createNotebook,
  deleteKnowledgeAnswer,
  deleteNotebook,
  deleteSource,
  fetchNotebooks,
  fetchSavedAnswers,
  fetchSources,
  saveKnowledgeAnswer,
  updateNotebook,
  uploadSource,
} from '../../api';
import {
  KnowledgeCitation,
  KnowledgeNotebook,
  KnowledgeSavedAnswer,
  KnowledgeSource,
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

const formatDateTime = (value?: string | null): string => {
  if (!value) {
    return '—';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }
  return parsed.toLocaleString('ru-RU');
};

export const KnowledgeDocumentsView: React.FC = () => {
  const [notebooks, setNotebooks] = useState<KnowledgeNotebook[]>([]);
  const [selectedNotebookId, setSelectedNotebookId] = useState('');
  const [selectedNotebookName, setSelectedNotebookName] = useState('');
  const [newNotebookName, setNewNotebookName] = useState('');
  const [notebookError, setNotebookError] = useState<string | null>(null);
  const [isNotebookBusy, setIsNotebookBusy] = useState(false);

  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [sourcesLoading, setSourcesLoading] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');

  const [question, setQuestion] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<KnowledgeCitation[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const [savedAnswers, setSavedAnswers] = useState<KnowledgeSavedAnswer[]>([]);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const sortedSources = useMemo(() => {
    return [...sources].sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [sources]);

  useEffect(() => {
    let isMounted = true;
    fetchNotebooks()
      .then((items) => {
        if (!isMounted) {
          return;
        }
        setNotebooks(items);
        if (!selectedNotebookId && items.length > 0) {
          setSelectedNotebookId(items[0].id);
          setSelectedNotebookName(items[0].name);
        }
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        const message =
          err instanceof Error
            ? err.message
            : 'Не удалось загрузить блокноты.';
        setNotebookError(message);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedNotebookId]);

  useEffect(() => {
    if (!selectedNotebookId) {
      setSources([]);
      setSavedAnswers([]);
      setAnswer('');
      setCitations([]);
      return;
    }
    setSourcesLoading(true);
    setSourcesError(null);
    Promise.all([
      fetchSources(selectedNotebookId),
      fetchSavedAnswers(selectedNotebookId),
    ])
      .then(([sourcesData, savedData]) => {
        setSources(sourcesData);
        setSavedAnswers(savedData);
        setAskError(null);
        setSavedError(null);
      })
      .catch((err) => {
        const message =
          err instanceof Error
            ? err.message
            : 'Не удалось загрузить данные блокнота.';
        setSourcesError(message);
      })
      .finally(() => setSourcesLoading(false));
  }, [selectedNotebookId]);

  const handleNotebookSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const notebookId = event.target.value;
    setSelectedNotebookId(notebookId);
    const notebook = notebooks.find((item) => item.id === notebookId);
    setSelectedNotebookName(notebook?.name ?? '');
  };

  const handleCreateNotebook = async () => {
    const name = newNotebookName.trim();
    if (!name) {
      setNotebookError('Введите название блокнота.');
      return;
    }
    setNotebookError(null);
    setIsNotebookBusy(true);
    try {
      const notebook = await createNotebook({ name });
      setNotebooks((prev) => [notebook, ...prev]);
      setSelectedNotebookId(notebook.id);
      setSelectedNotebookName(notebook.name);
      setNewNotebookName('');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось создать блокнот.';
      setNotebookError(message);
    } finally {
      setIsNotebookBusy(false);
    }
  };

  const handleRenameNotebook = async () => {
    if (!selectedNotebookId) {
      return;
    }
    const name = selectedNotebookName.trim();
    if (!name) {
      setNotebookError('Введите название блокнота.');
      return;
    }
    setNotebookError(null);
    setIsNotebookBusy(true);
    try {
      const updated = await updateNotebook({
        notebookId: selectedNotebookId,
        name,
      });
      setNotebooks((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setSelectedNotebookName(updated.name);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось переименовать блокнот.';
      setNotebookError(message);
    } finally {
      setIsNotebookBusy(false);
    }
  };

  const handleDeleteNotebook = async () => {
    if (!selectedNotebookId) {
      return;
    }
    const current = notebooks.find((item) => item.id === selectedNotebookId);
    const confirmed = window.confirm(
      `Удалить блокнот "${current?.name ?? ''}"? Все файлы и заметки будут удалены.`
    );
    if (!confirmed) {
      return;
    }
    setNotebookError(null);
    setIsNotebookBusy(true);
    try {
      await deleteNotebook(selectedNotebookId);
      const next = notebooks.filter((item) => item.id !== selectedNotebookId);
      setNotebooks(next);
      const nextNotebook = next[0];
      setSelectedNotebookId(nextNotebook?.id ?? '');
      setSelectedNotebookName(nextNotebook?.name ?? '');
      setSources([]);
      setSavedAnswers([]);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось удалить блокнот.';
      setNotebookError(message);
    } finally {
      setIsNotebookBusy(false);
    }
  };

  const handleUpload = async (file: File) => {
    if (!selectedNotebookId) {
      setSourcesError('Выберите блокнот перед загрузкой файла.');
      return;
    }
    try {
      await uploadSource({
        notebookId: selectedNotebookId,
        title: uploadTitle.trim() || undefined,
        file,
      });
      setUploadTitle('');
      const refreshed = await fetchSources(selectedNotebookId);
      setSources(refreshed);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось загрузить файл.';
      setSourcesError(message);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!selectedNotebookId) {
      return;
    }
    const confirmed = window.confirm('Удалить файл из блокнота?');
    if (!confirmed) {
      return;
    }
    try {
      await deleteSource(sourceId);
      setSources((prev) => prev.filter((item) => item.id !== sourceId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Не удалось удалить файл.';
      setSourcesError(message);
    }
  };

  const handleAsk = async () => {
    if (!selectedNotebookId) {
      setAskError('Выберите блокнот для вопроса.');
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
      const response = await askKnowledgeBase(selectedNotebookId, trimmedQuestion);
      setAnswer(response.answer);
      setCitations(response.citations ?? []);
      setLastQuestion(trimmedQuestion);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Ошибка запроса к базе знаний';
      setAskError(message);
    } finally {
      setIsAsking(false);
    }
  };

  const handleSaveAnswer = async () => {
    if (!selectedNotebookId) {
      setSavedError('Выберите блокнот для сохранения ответа.');
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
        notebookId: selectedNotebookId,
        question: lastQuestion,
        answer,
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
    try {
      await deleteKnowledgeAnswer(answerId);
      setSavedAnswers((prev) => prev.filter((item) => item.id !== answerId));
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Не удалось удалить сохранённый ответ.';
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
        parts.push(<sup key={`cite-${key}`}>[{number}]</sup>);
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
            Управляйте блокнотами Open Notebook прямо из CRM: создавайте, загружайте файлы и задавайте вопросы.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-1 text-sm text-slate-600">
            Блокнот
            <select
              value={selectedNotebookId}
              onChange={handleNotebookSelect}
              className="field field-input"
              disabled={isNotebookBusy}
            >
              <option value="">Выберите блокнот</option>
              {notebooks.map((notebook) => (
                <option key={notebook.id} value={notebook.id}>
                  {notebook.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-sm text-slate-600">
            Название блока
            <input
              type="text"
              value={selectedNotebookName}
              onChange={(event) => setSelectedNotebookName(event.target.value)}
              placeholder="Название выбранного блокнота"
              className="field field-input"
              disabled={!selectedNotebookId || isNotebookBusy}
            />
          </label>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm rounded-xl"
              onClick={handleRenameNotebook}
              disabled={!selectedNotebookId || isNotebookBusy}
            >
              Сохранить название
            </button>
            <button
              type="button"
              className="btn btn-danger btn-sm rounded-xl"
              onClick={handleDeleteNotebook}
              disabled={!selectedNotebookId || isNotebookBusy}
            >
              Удалить блокнот
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={newNotebookName}
            onChange={(event) => setNewNotebookName(event.target.value)}
            placeholder="Название нового блокнота"
            className="field field-input"
            disabled={isNotebookBusy}
          />
          <button
            type="button"
            className="btn btn-primary btn-sm rounded-xl"
            onClick={handleCreateNotebook}
            disabled={isNotebookBusy}
          >
            Создать блокнот
          </button>
        </div>
        {notebookError && <div className="app-alert app-alert-danger">{notebookError}</div>}
      </section>

      <section className="app-panel space-y-6 p-6 shadow-none">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Файлы блокнота</h3>
          <p className="text-xs text-slate-500">Загрузка файлов идёт напрямую в Open Notebook.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-1 text-sm text-slate-600">
            Заголовок (пояснение)
            <input
              type="text"
              value={uploadTitle}
              onChange={(event) => setUploadTitle(event.target.value)}
              placeholder="Название файла"
              className="field field-input"
              disabled={!selectedNotebookId}
            />
          </label>
        </div>
        <FileUploadManager onUpload={handleUpload} disabled={!selectedNotebookId} />
        {sourcesError && <div className="app-alert app-alert-danger">{sourcesError}</div>}
        <div className="space-y-4">
          {sourcesLoading && (
            <div className="text-xs uppercase tracking-wide text-slate-400">Загрузка...</div>
          )}
          {sortedSources.length === 0 && !sourcesLoading && (
            <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">
              Пока нет загруженных файлов.
            </div>
          )}
          {sortedSources.map((source) => (
            <div
              key={source.id}
              className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-2 shadow-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">{source.title || 'Без названия'}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(source.createdAt)}</p>
                </div>
                {source.embedded !== null && (
                  <span className="text-xs text-slate-500">
                    {source.embedded ? 'Векторизирован' : 'Без эмбеддингов'}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {source.fileUrl ? (
                  <a
                    href={source.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm rounded-xl"
                  >
                    Открыть файл
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">Ссылка недоступна</span>
                )}
                <button
                  type="button"
                  className="btn btn-danger btn-sm rounded-xl"
                  onClick={() => handleDeleteSource(source.id)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="app-panel space-y-6 p-6 shadow-none">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Задать вопрос</h3>
          <p className="text-xs text-slate-500">Вопрос будет задан внутри выбранного блокнота.</p>
        </div>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Например: Какие исключения есть в правилах?"
          rows={3}
          className="field field-input"
          disabled={isAsking || !selectedNotebookId}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-primary btn-sm rounded-xl"
            onClick={handleAsk}
            disabled={isAsking || !selectedNotebookId}
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
                disabled={savingAnswer || !selectedNotebookId}
              >
                {savingAnswer ? 'Сохраняем...' : 'Сохранить ответ'}
              </button>
              {savedError && (
                <span className="text-xs text-rose-600">{savedError}</span>
              )}
            </div>
          </div>
        )}
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
              <div className="text-xs text-slate-500">{formatDate(item.createdAt)}</div>
              <div className="text-sm font-semibold text-slate-900">{item.question}</div>
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
