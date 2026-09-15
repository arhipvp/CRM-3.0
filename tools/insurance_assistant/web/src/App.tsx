import { useCallback, useEffect, useState } from "react";
import { Chat } from "./components/Chat";
import { ConversationList } from "./components/ConversationList";
import { DocumentLibrary } from "./components/DocumentLibrary";
import * as api from "./lib/api";
import type {
  Citation,
  Conversation,
  DocumentItem,
  Message,
  ProviderInfo,
  Usage,
  UsageSummary,
} from "./types";

function errorText(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Произошла непредвиденная ошибка.";
}

export default function App() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<Conversation>();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string>();
  const [citation, setCitation] = useState<Citation>();
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [usage, setUsage] = useState<UsageSummary>();
  const [lastUsage, setLastUsage] = useState<Usage>();
  const [provider, setProvider] = useState(
    () => localStorage.getItem("insurance.provider") || "codex",
  );
  const [model, setModel] = useState(
    () => localStorage.getItem("insurance.model") || "",
  );

  const refreshDocuments = useCallback(
    async () => setDocuments(await api.getDocuments()),
    [],
  );
  const refreshConversations = useCallback(
    async () => setConversations(await api.getConversations()),
    [],
  );

  useEffect(() => {
    Promise.all([
      refreshDocuments(),
      refreshConversations(),
      api.getProviders().then((result) => setProviders(result.providers)),
      api.getUsage().then(setUsage),
    ])
      .catch((reason) => setError(errorText(reason)))
      .finally(() => setLoading(false));
  }, [refreshDocuments, refreshConversations]);

  useEffect(() => {
    const selected = providers.find((item) => item.id === provider);
    if (!selected || !selected.available) {
      const first = providers.find((item) => item.available);
      if (first) setProvider(first.id);
      return;
    }
    if (!selected.models.includes(model)) {
      const next = selected.default_model || selected.models[0] || "";
      setModel(next);
    }
  }, [providers, provider, model]);

  useEffect(() => {
    localStorage.setItem("insurance.provider", provider);
    localStorage.setItem("insurance.model", model);
  }, [provider, model]);

  useEffect(() => {
    const timer = window.setInterval(
      () => refreshDocuments().catch(() => undefined),
      2500,
    );
    return () => window.clearInterval(timer);
  }, [refreshDocuments]);

  const upload = async (files: File[]) => {
    setUploading(true);
    setError(undefined);
    try {
      await api.uploadDocuments(files);
      await refreshDocuments();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setUploading(false);
    }
  };
  const removeDocument = async (document: DocumentItem) => {
    if (
      !window.confirm(
        `Удалить «${document.filename}» из локальной базы знаний?`,
      )
    )
      return;
    try {
      await api.deleteDocument(document.id);
      await refreshDocuments();
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const openConversation = async (id: string) => {
    try {
      const detail = await api.getConversation(id);
      setActive({
        ...detail,
        title:
          conversations.find((conversation) => conversation.id === id)?.title ??
          detail.title,
      });
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const createConversation = async () => {
    try {
      const conversation = await api.createConversation();
      setActive({ ...conversation, messages: [] });
      await refreshConversations();
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const removeConversation = async (conversation: Conversation) => {
    if (
      !window.confirm(
        `Удалить чат «${conversation.title || "Новый разговор"}»?`,
      )
    )
      return;
    try {
      await api.deleteConversation(conversation.id);
      if (active?.id === conversation.id) setActive(undefined);
      await refreshConversations();
    } catch (reason) {
      setError(errorText(reason));
    }
  };
  const send = async (content: string) => {
    let conversation = active;
    try {
      setError(undefined);
      if (!conversation) {
        conversation = await api.createConversation();
        setActive({ ...conversation, messages: [] });
      }
      const user: Message = {
        id: `local-user-${Date.now()}`,
        role: "user",
        content,
      };
      const assistant: Message = {
        id: `local-assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        citations: [],
      };
      const targetId = conversation.id;
      setActive((current) => ({
        ...(current ?? conversation!),
        messages: [...(current?.messages ?? []), user, assistant],
      }));
      setSending(true);
      await api.streamMessage(targetId, content, provider, model, (update) => {
        if (update.error) {
          setError(update.error);
          return;
        }
        if (update.usage) setLastUsage(update.usage);
        setActive((current) => {
          if (!current) return current;
          const messages = [...(current.messages ?? [])];
          const last = messages[messages.length - 1];
          if (last?.role === "assistant")
            messages[messages.length - 1] = {
              ...last,
              content:
                update.content ??
                last.content + (update.token ?? update.text ?? ""),
              citations: update.citations ?? last.citations,
              provider: update.usage?.provider ?? last.provider,
              model: update.usage?.model ?? last.model,
              usage: update.usage ?? last.usage,
            };
          return { ...current, messages };
        });
      });
      await api.getUsage().then(setUsage);
      await refreshConversations();
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setSending(false);
    }
  };

  const readyDocuments = documents.some(
    (document) => document.status === "ready",
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <span>
            Страховой
            <br />
            помощник
          </span>
        </div>
        <ConversationList
          conversations={conversations}
          activeId={active?.id}
          onCreate={createConversation}
          onOpen={openConversation}
          onDelete={removeConversation}
        />
        <DocumentLibrary
          documents={documents}
          busy={uploading}
          onUpload={upload}
          onDelete={removeDocument}
        />
      </aside>
      <Chat
        messages={active?.messages ?? []}
        sending={sending}
        disabled={!readyDocuments}
        onSend={send}
        onCitation={setCitation}
        provider={provider}
        model={model}
        providers={providers}
        usage={usage}
        lastUsage={lastUsage}
        onProviderChange={(value) => {
          setProvider(value);
          setLastUsage(undefined);
        }}
        onModelChange={setModel}
      />
      {loading && (
        <div className="loading-cover">Загружаем локальную базу знаний…</div>
      )}
      {error && (
        <div className="toast" role="alert">
          {error}
          {provider === "codex" &&
          providers.some((item) => item.id === "polza" && item.available) ? (
            <button
              className="toast-fallback"
              type="button"
              onClick={() => {
                setProvider("polza");
                setError(undefined);
              }}
            >
              Переключиться на Polza
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setError(undefined)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
      )}
      {citation && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setCitation(undefined)}
        >
          <aside
            className="source-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Источник"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="icon-button close-source"
              onClick={() => setCitation(undefined)}
              type="button"
              aria-label="Закрыть"
            >
              ×
            </button>
            <p className="eyebrow">Источник</p>
            <h2>{citation.filename}</h2>
            <p className="source-location">
              {citation.location?.page
                ? `Страница ${citation.location.page}`
                : citation.location?.sheet
                  ? `Лист «${citation.location.sheet}»`
                  : citation.location?.slide
                    ? `Слайд ${citation.location.slide}`
                    : citation.location?.attachment_name
                      ? `Вложение «${citation.location.attachment_name}»`
                      : "Фрагмент документа"}
            </p>
            <blockquote>
              {citation.excerpt ||
                "Для этого фрагмента пока нет предпросмотра."}
            </blockquote>
          </aside>
        </div>
      )}
    </div>
  );
}
