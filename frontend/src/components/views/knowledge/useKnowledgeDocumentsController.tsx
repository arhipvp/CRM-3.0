import { useEffect, useMemo, useState } from 'react';

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
} from '../../../api';
import { confirmTexts } from '../../../constants/confirmTexts';
import { useConfirm } from '../../../hooks/useConfirm';
import type {
  KnowledgeCitation,
  KnowledgeChatSession,
  KnowledgeNotebook,
  KnowledgeSavedAnswer,
  KnowledgeSource,
  KnowledgeSourceDetail,
} from '../../../types';

export const useKnowledgeDocumentsController = () => {
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
    const confirmed = await confirm(confirmTexts.deleteNotebook(current?.name));
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
    const confirmed = await confirm(confirmTexts.deleteNotebookSource());
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
    const confirmed = await confirm(confirmTexts.deleteChatSession());
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

  return {
    notebooks,
    selectedNotebookId,
    selectedNotebookName,
    setSelectedNotebookName,
    newNotebookName,
    setNewNotebookName,
    notebookError,
    isNotebookBusy,
    sortedSources,
    sourcesError,
    sourcesLoading,
    uploadTitle,
    setUploadTitle,
    chatSessions,
    selectedSessionId,
    setSelectedSessionId,
    sessionsError,
    sessionsLoading,
    isSessionsModalOpen,
    setIsSessionsModalOpen,
    newSessionTitle,
    setNewSessionTitle,
    editingSessionId,
    editingSessionTitle,
    setEditingSessionTitle,
    question,
    setQuestion,
    lastQuestion,
    answer,
    citations,
    isAsking,
    askError,
    savedAnswers,
    savingAnswer,
    savedError,
    sourceDetail,
    setSourceDetail,
    isSourceModalOpen,
    setIsSourceModalOpen,
    sourceLoading,
    sourceError,
    setSourceError,
    handleNotebookSelect,
    handleCreateNotebook,
    handleRenameNotebook,
    handleDeleteNotebook,
    handleUpload,
    handleDeleteSource,
    handleOpenSource,
    handleCreateSession,
    handleStartEditSession,
    handleCancelEditSession,
    handleSaveSessionTitle,
    handleDeleteSession,
    handleAsk,
    handleSaveAnswer,
    handleDeleteSavedAnswer,
    ConfirmDialogRenderer,
  };
};
