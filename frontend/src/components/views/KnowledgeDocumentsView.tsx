import React, { useEffect, useMemo, useState } from 'react';
import { FileUploadManager } from '../FileUploadManager';
import {
  askKnowledgeBase,
  createChatSession,
  createNotebook,
  deleteChatSession,
  deleteKnowledgeAnswer,
  deleteNotebook,
  deleteSource,
  fetchChatSessions,
  fetchNotebooks,
  fetchSourceDetail,
  fetchSavedAnswers,
  fetchSources,
  saveKnowledgeAnswer,
  updateChatSession,
  updateNotebook,
  uploadSource,
} from '../../api';
import {
  KnowledgeCitation,
  KnowledgeChatSession,
  KnowledgeNotebook,
  KnowledgeSavedAnswer,
  KnowledgeSource,
  KnowledgeSourceDetail,
} from '../../types';
import { Modal } from '../Modal';
import { useConfirm } from '../../hooks/useConfirm';

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
  const { confirm, ConfirmDialogRenderer } = useConfirm();
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

  const [chatSessions, setChatSessions] = useState<KnowledgeChatSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [isSessionsModalOpen, setIsSessionsModalOpen] = useState(false);
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionTitle, setEditingSessionTitle] = useState('');

  const [question, setQuestion] = useState('');
  const [lastQuestion, setLastQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<KnowledgeCitation[]>([]);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const [savedAnswers, setSavedAnswers] = useState<KnowledgeSavedAnswer[]>([]);
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const [sourceDetail, setSourceDetail] = useState<KnowledgeSourceDetail | null>(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);

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
        const message = err instanceof Error ? err.message : 'Не удалось загрузить блокноты.';
        setNotebookError(message);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedNotebookId]);

  useEffect(() => {
    if (!selectedNotebookId) {
      setSources([]);
      setChatSessions([]);
      setSelectedSessionId('');
      setSavedAnswers([]);
      setAnswer('');
      setCitations([]);
      return;
    }
    setSourcesLoading(true);
    setSourcesError(null);
    setSessionsLoading(true);
    setSessionsError(null);
    Promise.all([
      fetchSources(selectedNotebookId),
      fetchChatSessions(selectedNotebookId),
      fetchSavedAnswers(selectedNotebookId),
    ])
      .then(([sourcesData, sessionsData, savedData]) => {
        setSources(sourcesData);
        setChatSessions(sessionsData);
        setSelectedSessionId((prev) => prev || sessionsData[0]?.id || '');
        setSavedAnswers(savedData);
        setAskError(null);
        setSavedError(null);
      })
      .catch((err) => {
        const message =
          err instanceof Error ? err.message : 'Не удалось загрузить данные блокнота.';
        setSourcesError(message);
        setSessionsError(message);
      })
      .finally(() => {
        setSourcesLoading(false);
        setSessionsLoading(false);
      });
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
      const message = err instanceof Error ? err.message : 'Не удалось создать блокнот.';
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
      setNotebooks((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedNotebookName(updated.name);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось переименовать блокнот.';
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
    const confirmed = await confirm({
      title: 'Удалить блокнот',
      message: `Удалить блокнот "${current?.name ?? ''}"? Все файлы и заметки будут удалены.`,
      confirmText: 'Удалить',
      tone: 'danger',
    });
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
      const message = err instanceof Error ? err.message : 'Не удалось удалить блокнот.';
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
      const message = err instanceof Error ? err.message : 'Не удалось загрузить файл.';
      setSourcesError(message);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!selectedNotebookId) {
      return;
    }
    const confirmed = await confirm({
      title: 'Удалить файл',
      message: 'Удалить файл из блокнота?',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    try {
      await deleteSource(sourceId);
      setSources((prev) => prev.filter((item) => item.id !== sourceId));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить файл.';
      setSourcesError(message);
    }
  };

  const handleOpenSource = async (sourceId: string) => {
    setIsSourceModalOpen(true);
    setSourceLoading(true);
    setSourceError(null);
    try {
      const detail = await fetchSourceDetail(sourceId);
      setSourceDetail(detail);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить источник.';
      setSourceError(message);
      setSourceDetail(null);
    } finally {
      setSourceLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!selectedNotebookId) {
      setSessionsError('Выберите блокнот для создания сессии.');
      return;
    }
    setSessionsError(null);
    try {
      const session = await createChatSession({
        notebookId: selectedNotebookId,
        title: newSessionTitle.trim() || undefined,
      });
      setChatSessions((prev) => [session, ...prev]);
      setSelectedSessionId(session.id);
      setNewSessionTitle('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось создать сессию.';
      setSessionsError(message);
    }
  };

  const handleStartEditSession = (session: KnowledgeChatSession) => {
    setEditingSessionId(session.id);
    setEditingSessionTitle(session.title ?? '');
  };

  const handleCancelEditSession = () => {
    setEditingSessionId(null);
    setEditingSessionTitle('');
  };

  const handleSaveSessionTitle = async () => {
    if (!editingSessionId) {
      return;
    }
    const title = editingSessionTitle.trim();
    if (!title) {
      setSessionsError('Введите название сессии.');
      return;
    }
    setSessionsError(null);
    try {
      const updated = await updateChatSession({
        sessionId: editingSessionId,
        title,
      });
      setChatSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (selectedSessionId === updated.id) {
        setSelectedSessionId(updated.id);
      }
      handleCancelEditSession();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось обновить сессию.';
      setSessionsError(message);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const confirmed = await confirm({
      title: 'Удалить сессию',
      message: 'Удалить сессию чата?',
      confirmText: 'Удалить',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }
    setSessionsError(null);
    try {
      await deleteChatSession(sessionId);
      setChatSessions((prev) => prev.filter((item) => item.id !== sessionId));
      if (selectedSessionId === sessionId) {
        setSelectedSessionId('');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось удалить сессию.';
      setSessionsError(message);
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
      const response = await askKnowledgeBase(
        selectedNotebookId,
        trimmedQuestion,
        selectedSessionId || undefined,
      );
      setAnswer(response.answer);
      setCitations(response.citations ?? []);
      setLastQuestion(trimmedQuestion);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Ошибка запроса к базе знаний';
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
      const message = err instanceof Error ? err.message : 'Не удалось сохранить ответ.';
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
      const message = err instanceof Error ? err.message : 'Не удалось удалить сохранённый ответ.';
      setSavedError(message);
    }
  };

  const collectReferenceItems = (text: string, sourceCitations: KnowledgeCitation[]) => {
    const regex = /\[source:([^\]]+)\]/g;
    const orderedIds: string[] = [];
    let match = regex.exec(text);
    while (match) {
      const sourceId = match[1];
      if (!orderedIds.includes(sourceId)) {
        orderedIds.push(sourceId);
      }
      match = regex.exec(text);
    }

    return orderedIds.map((sourceId) => {
      const citation = sourceCitations.find((item) => item.sourceId === sourceId);
      return {
        sourceId,
        title: citation?.title || 'Источник',
        fileUrl: citation?.fileUrl || null,
      };
    });
  };

  const renderAnswerWithCitations = (text: string, sourceCitations: KnowledgeCitation[]) => {
    const references = collectReferenceItems(text, sourceCitations);
    if (!references.length) {
      return text;
    }
    const indexBySource = new Map(references.map((item, index) => [item.sourceId, index + 1]));
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
          <sup key={`cite-${key}`}>
            <button
              type="button"
              className="text-blue-600 hover:text-blue-700"
              onClick={() => handleOpenSource(sourceId)}
            >
              [{number}]
            </button>
          </sup>,
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
            Управляйте блокнотами Open Notebook прямо из CRM: создавайте, загружайте файлы и
            задавайте вопросы.
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
          <h3 className="text-lg font-semibold text-slate-900">Задать вопрос</h3>
          <p className="text-xs text-slate-500">Вопрос будет задан внутри выбранного блокнота.</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block flex-1 min-w-[220px] space-y-1 text-sm text-slate-600">
            Сессия чата
            <select
              value={selectedSessionId}
              onChange={(event) => setSelectedSessionId(event.target.value)}
              className="field field-input"
              disabled={!selectedNotebookId || sessionsLoading}
            >
              <option value="">{sessionsLoading ? 'Загрузка сессий...' : 'Выберите сессию'}</option>
              {chatSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.title || 'Без названия'}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn btn-secondary btn-sm rounded-xl"
            onClick={() => setIsSessionsModalOpen(true)}
            disabled={!selectedNotebookId}
          >
            Сессии чата
          </button>
          {sessionsError && <span className="text-xs text-rose-600">{sessionsError}</span>}
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
            <div className="text-blue-700">{renderAnswerWithCitations(answer, citations)}</div>
            {collectReferenceItems(answer, citations).length > 0 && (
              <div className="border-t border-slate-100 pt-2 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-700">Источники</div>
                {collectReferenceItems(answer, citations).map((item, index) => (
                  <div key={item.sourceId} className="flex flex-wrap gap-2">
                    <span className="text-slate-500">[{index + 1}]</span>
                    <button
                      type="button"
                      className="text-blue-600 hover:text-blue-700"
                      onClick={() => handleOpenSource(item.sourceId)}
                    >
                      {item.title}
                    </button>
                    {item.fileUrl && (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-slate-700"
                      >
                        Файл
                      </a>
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
              {savedError && <span className="text-xs text-rose-600">{savedError}</span>}
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
          {savedError && <div className="app-alert app-alert-danger">{savedError}</div>}
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
                <span className="text-blue-700">
                  {renderAnswerWithCitations(item.answer, item.citations)}
                </span>
              </div>
              {collectReferenceItems(item.answer, item.citations).length > 0 && (
                <div className="text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-700">Источники</div>
                  {collectReferenceItems(item.answer, item.citations).map((cite, index) => (
                    <div key={`${item.id}-${cite.sourceId}`} className="flex flex-wrap gap-2">
                      <span className="text-slate-500">[{index + 1}]</span>
                      <button
                        type="button"
                        className="text-blue-600 hover:text-blue-700"
                        onClick={() => handleOpenSource(cite.sourceId)}
                      >
                        {cite.title}
                      </button>
                      {cite.fileUrl && (
                        <a
                          href={cite.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-slate-700"
                        >
                          Файл
                        </a>
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
                  <p className="text-base font-semibold text-slate-900">
                    {source.title || 'Без названия'}
                  </p>
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
      {isSessionsModalOpen && (
        <Modal
          title="Сессии чата"
          onClose={() => {
            setIsSessionsModalOpen(false);
            handleCancelEditSession();
          }}
          size="md"
        >
          <div className="space-y-4">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={newSessionTitle}
                onChange={(event) => setNewSessionTitle(event.target.value)}
                placeholder="Название новой сессии"
                className="field field-input"
              />
              <button
                type="button"
                className="btn btn-primary btn-sm rounded-xl"
                onClick={handleCreateSession}
                disabled={!selectedNotebookId}
              >
                Создать
              </button>
            </div>
            {sessionsError && <div className="text-xs text-rose-600">{sessionsError}</div>}
            <div className="space-y-2">
              {chatSessions.length === 0 && (
                <div className="text-sm text-slate-500">Сессий пока нет.</div>
              )}
              {chatSessions.map((session) => {
                const isSelected = session.id === selectedSessionId;
                const isEditing = session.id === editingSessionId;
                return (
                  <div
                    key={session.id}
                    className={`rounded-xl border p-3 space-y-2 ${
                      isSelected ? 'border-blue-200 bg-blue-50' : 'border-slate-200'
                    }`}
                  >
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editingSessionTitle}
                          onChange={(event) => setEditingSessionTitle(event.target.value)}
                          className="field field-input"
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm rounded-xl"
                            onClick={handleSaveSessionTitle}
                          >
                            Сохранить
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm rounded-xl"
                            onClick={handleCancelEditSession}
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">
                              {session.title || 'Без названия'}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatDateTime(session.updatedAt || session.createdAt)}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm rounded-xl"
                              onClick={() => setSelectedSessionId(session.id)}
                            >
                              Использовать
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm rounded-xl"
                              onClick={() => handleStartEditSession(session)}
                            >
                              Переименовать
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm rounded-xl"
                              onClick={() => handleDeleteSession(session.id)}
                            >
                              Удалить
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Modal>
      )}
      {isSourceModalOpen && (
        <Modal
          title={sourceDetail?.title || 'Источник'}
          onClose={() => {
            setIsSourceModalOpen(false);
            setSourceDetail(null);
            setSourceError(null);
          }}
          size="xl"
        >
          <div className="space-y-3">
            {sourceLoading && <div className="text-sm text-slate-500">Загрузка источника...</div>}
            {sourceError && <div className="text-sm text-rose-600">{sourceError}</div>}
            {!sourceLoading && !sourceError && (
              <>
                <div className="text-xs text-slate-500">
                  {formatDateTime(sourceDetail?.createdAt)}
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700 whitespace-pre-wrap">
                  {sourceDetail?.content || 'Текст источника недоступен.'}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sourceDetail?.fileUrl && (
                    <a
                      href={sourceDetail.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm rounded-xl"
                    >
                      Открыть файл
                    </a>
                  )}
                  {sourceDetail?.assetUrl && (
                    <a
                      href={sourceDetail.assetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm rounded-xl"
                    >
                      Оригинал
                    </a>
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
      <ConfirmDialogRenderer />
    </div>
  );
};
