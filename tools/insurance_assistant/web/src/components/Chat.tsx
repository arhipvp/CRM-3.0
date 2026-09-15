import { useEffect, useRef, useState } from "react";
import type {
  Citation,
  Message,
  ProviderInfo,
  Usage,
  UsageSummary,
} from "../types";

function sourceLabel(citation: Citation) {
  const location = citation.location;
  if (location?.page) return `${citation.filename}, стр. ${location.page}`;
  if (location?.sheet) return `${citation.filename}, лист «${location.sheet}»`;
  if (location?.slide) return `${citation.filename}, слайд ${location.slide}`;
  if (location?.attachment_name)
    return `${citation.filename} → ${location.attachment_name}`;
  return citation.filename;
}

interface Props {
  messages: Message[];
  sending: boolean;
  disabled: boolean;
  onSend(content: string): void;
  onCitation(citation: Citation): void;
  provider?: string;
  model?: string;
  providers?: ProviderInfo[];
  usage?: UsageSummary;
  lastUsage?: Usage;
  onProviderChange?(provider: string): void;
  onModelChange?(model: string): void;
}

export function Chat({
  messages,
  sending,
  disabled,
  onSend,
  onCitation,
  provider = "codex",
  model = "",
  providers = [],
  usage,
  lastUsage,
  onProviderChange = () => undefined,
  onModelChange = () => undefined,
}: Props) {
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const submit = () => {
    const value = draft.trim();
    if (!value || sending || disabled) return;
    setDraft("");
    onSend(value);
  };

  return (
    <main className="chat" aria-label="Чат со страховым помощником">
      <header className="chat-header">
        <div>
          <p className="eyebrow">Локальный RAG</p>
          <h1>Страховой помощник</h1>
        </div>
        <span className="privacy-badge">
          <span /> Данные на этом компьютере
        </span>
      </header>
      <div className="provider-bar">
        <label>
          Провайдер
          <select
            value={provider}
            onChange={(event) => onProviderChange(event.target.value)}
            disabled={sending}
          >
            {providers.map((item) => (
              <option key={item.id} value={item.id} disabled={!item.available}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Модель
          <select
            value={model}
            onChange={(event) => onModelChange(event.target.value)}
            disabled={sending || !model}
          >
            {model ? <option value={model}>{model}</option> : null}
            {(providers.find((item) => item.id === provider)?.models ?? [])
              .filter((item) => item !== model)
              .map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
          </select>
        </label>
        <span className="billing-note">
          {provider === "polza"
            ? "Запрос тарифицируется Polza"
            : "Лимит ChatGPT / Codex"}
        </span>
        <span className="usage-note">
          Последний: {formatCost(lastUsage?.cost_rub)} · всего Polza:{" "}
          {formatCost(
            usage?.providers.find((item) => item.provider === "polza")
              ?.cost_rub,
          )}
        </span>
      </div>
      <div className="message-area">
        {messages.length === 0 && (
          <div className="welcome">
            <p className="spark">✦</p>
            <h2>Спросите по вашим документам</h2>
            <p>
              Помощник опирается только на загруженные источники и указывает,
              где нашёл ответ.
            </p>
            <div className="suggestions">
              {[
                "Какие исключения есть в правилах?",
                "Сравни условия двух продуктов",
                "Подготовь краткое резюме документа",
              ].map((item) => (
                <button type="button" key={item} onClick={() => setDraft(item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((message) => (
          <article className={`message ${message.role}`} key={message.id}>
            <div className="message-label">
              {message.role === "user" ? "Вы" : "Помощник"}
              {message.role === "assistant" && message.provider ? (
                <span className="message-meta">
                  {message.provider} · {message.model} ·{" "}
                  {formatCost(message.usage?.cost_rub)}
                </span>
              ) : null}
            </div>
            <div className="message-content">
              {message.content ||
                (sending && message.role === "assistant" ? (
                  <span className="typing">
                    Думаю<span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                ) : (
                  ""
                ))}
            </div>
            {message.citations && message.citations.length > 0 && (
              <div className="citations">
                {message.citations.map((citation, index) => (
                  <button
                    type="button"
                    key={citation.id ?? `${citation.document_id}-${index}`}
                    className="citation"
                    onClick={() => onCitation(citation)}
                    title={citation.excerpt}
                  >
                    [{index + 1}] {sourceLabel(citation)}
                  </button>
                ))}
              </div>
            )}
          </article>
        ))}
        <div ref={end} />
      </div>
      <form
        className="composer"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={
            disabled
              ? "Сначала загрузите документ"
              : "Задайте вопрос по документам…"
          }
          disabled={sending || disabled}
          rows={1}
          aria-label="Вопрос"
        />
        <button
          className="send"
          type="submit"
          disabled={!draft.trim() || sending || disabled}
          aria-label="Отправить вопрос"
        >
          ↑
        </button>
      </form>
      <p className="hint">Enter — отправить · Shift + Enter — новая строка</p>
    </main>
  );
}

function formatCost(value?: number | null) {
  if (value == null) return "стоимость н/д";
  return `${value.toFixed(4)} ₽`;
}
