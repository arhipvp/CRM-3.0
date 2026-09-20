import { useEffect, useMemo, useState } from 'react';

import {
  createAiConversation,
  deleteAiDocument,
  fetchAiConversations,
  fetchAiDocuments,
  fetchAiMessages,
  streamAiAnswer,
  uploadAiDocuments,
  type AiConversation,
  type AiDocument,
  type AiMessage,
} from '../../api/aiAssistant';
import type { User } from '../../types';
import { Button } from '../common/Button';
import { PageHeader } from '../common/layoutPrimitives';

export function AiAssistantView({ currentUser }: { currentUser: User | null }) {
  const canManageLibrary = Boolean(
    currentUser?.isStaff || currentUser?.username.toLocaleLowerCase() === 'vova',
  );
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [documents, setDocuments] = useState<AiDocument[]>([]);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadConversations = async () => {
    const items = await fetchAiConversations();
    setConversations(items);
    setSelectedId((current) => current ?? items[0]?.id ?? null);
  };
  useEffect(() => {
    void loadConversations().catch((err) => setError(String(err)));
  }, []);
  useEffect(() => {
    if (selectedId)
      void fetchAiMessages(selectedId)
        .then(setMessages)
        .catch((err) => setError(String(err)));
  }, [selectedId]);
  useEffect(() => {
    if (canManageLibrary)
      void fetchAiDocuments()
        .then(setDocuments)
        .catch((err) => setError(String(err)));
  }, [canManageLibrary]);

  const selected = useMemo(
    () => conversations.find((item) => item.id === selectedId),
    [conversations, selectedId],
  );
  const createChat = async () => {
    const chat = await createAiConversation();
    setConversations((items) => [chat, ...items]);
    setSelectedId(chat.id);
    setMessages([]);
  };
  const send = async () => {
    const text = question.trim();
    if (!text || loading) return;
    let conversationId = selectedId;
    if (!conversationId) {
      const chat = await createAiConversation(text.slice(0, 60));
      setConversations((items) => [chat, ...items]);
      conversationId = chat.id;
      setSelectedId(chat.id);
    }
    setQuestion('');
    setLoading(true);
    setError(null);
    setMessages((items) => [
      ...items,
      { id: `local-${Date.now()}`, role: 'user', content: text, citations: [] },
      { id: 'pending', role: 'assistant', content: '', citations: [] },
    ]);
    try {
      await streamAiAnswer(conversationId, text, (event, payload) => {
        if (event === 'delta' && typeof payload === 'string')
          setMessages((items) =>
            items.map((item) =>
              item.id === 'pending' ? { ...item, content: item.content + payload } : item,
            ),
          );
        if (event === 'done' && payload && typeof payload === 'object') {
          const value = payload as {
            content?: string;
            citations?: AiMessage['citations'];
            usage?: AiMessage['usage'];
          };
          setMessages((items) =>
            items.map((item) =>
              item.id === 'pending'
                ? {
                    ...item,
                    id: `answer-${Date.now()}`,
                    content: value.content ?? item.content,
                    citations: value.citations ?? [],
                    usage: value.usage,
                  }
                : item,
            ),
          );
        }
        if (event === 'error') setError(typeof payload === 'string' ? payload : 'Ошибка ответа');
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setMessages((items) => items.filter((item) => item.id !== 'pending'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="ИИ-помощник"
        description="Ответы строятся только по общей библиотеке страховых документов."
      />
      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)_280px]">
        <aside className="rounded border border-[var(--app-border)] bg-white p-3">
          <Button onClick={() => void createChat()} variant="primary" size="block">
            Новый чат
          </Button>
          <div className="mt-3 space-y-1">
            {conversations.map((chat) => (
              <button
                key={chat.id}
                className={`w-full rounded px-2 py-2 text-left text-sm ${chat.id === selectedId ? 'bg-[var(--app-brand-50)]' : 'hover:bg-slate-50'}`}
                onClick={() => setSelectedId(chat.id)}
              >
                {chat.title}
              </button>
            ))}
          </div>
        </aside>
        <section className="flex min-h-[620px] flex-col rounded border border-[var(--app-border)] bg-white p-4">
          <div className="mb-3 text-sm text-slate-500">
            {selected?.title ?? 'Новый чат'} · Polza
          </div>
          <div className="flex-1 space-y-4 overflow-auto">
            {messages.map((message) => (
              <article
                key={message.id}
                className={`rounded p-3 text-sm ${message.role === 'user' ? 'ml-12 bg-[var(--app-brand-50)]' : 'mr-12 bg-slate-50'}`}
              >
                <p className="whitespace-pre-wrap">
                  {message.content || (loading ? 'Готовлю ответ…' : '')}
                </p>
                {message.usage && (
                  <p className="mt-2 text-xs text-slate-500">
                    {message.usage.model}
                    {message.usage.cost_rub != null ? ` · ${message.usage.cost_rub} ₽` : ''}
                  </p>
                )}
                {message.citations?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {message.citations.map((citation, index) => (
                      <span
                        key={`${citation.document_id}-${index}`}
                        className="rounded bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
                      >
                        [{index + 1}] {citation.filename}, {citation.location}
                      </span>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              className="min-h-12 flex-1 rounded border border-[var(--app-border)] p-3 text-sm"
              placeholder="Спросите по страховым документам…"
            />
            <Button onClick={() => void send()} variant="primary" disabled={loading}>
              Отправить
            </Button>
          </div>
        </section>
        <aside className="rounded border border-[var(--app-border)] bg-white p-3">
          <h2 className="font-semibold">Источники</h2>
          {canManageLibrary ? (
            <>
              <label className="mt-3 block cursor-pointer rounded border border-dashed p-3 text-center text-sm">
                <input
                  className="hidden"
                  type="file"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length)
                      void uploadAiDocuments(files)
                        .then(fetchAiDocuments)
                        .then(setDocuments)
                        .catch((err) => setError(String(err)));
                  }}
                />
                Загрузить документы
              </label>
              <div className="mt-3 space-y-2">
                {documents.map((doc) => (
                  <div key={doc.id} className="rounded bg-slate-50 p-2 text-xs">
                    <div>{doc.filename}</div>
                    <div className="text-slate-500">
                      {doc.status} · {doc.chunks} фрагм.
                    </div>
                    <button
                      className="mt-1 text-red-600"
                      onClick={() =>
                        void deleteAiDocument(doc.id)
                          .then(() =>
                            setDocuments((items) => items.filter((item) => item.id !== doc.id)),
                          )
                          .catch((err) => setError(String(err)))
                      }
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              Библиотека общая. Загрузкой и удалением управляют Vova и администраторы.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
