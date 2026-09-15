import type { Conversation } from "../types";

interface Props {
  conversations: Conversation[];
  activeId?: string;
  onCreate(): void;
  onOpen(id: string): void;
  onDelete(conversation: Conversation): void;
}

export function ConversationList({
  conversations,
  activeId,
  onCreate,
  onOpen,
  onDelete,
}: Props) {
  return (
    <nav className="conversations" aria-label="История чатов">
      <div className="section-heading conversation-title">
        <div>
          <p className="eyebrow">Диалоги</p>
          <h2>Рабочие чаты</h2>
        </div>
        <button className="new-chat" type="button" onClick={onCreate}>
          + Новый
        </button>
      </div>
      <div className="conversation-list">
        {conversations.length === 0 && (
          <p className="empty-documents">
            Начните первый разговор о документах.
          </p>
        )}
        {conversations.map((conversation) => (
          <div
            className={`conversation-row ${conversation.id === activeId ? "active" : ""}`}
            key={conversation.id}
          >
            <button
              className="conversation-open"
              type="button"
              onClick={() => onOpen(conversation.id)}
            >
              <span className="conversation-dot" />
              <span>{conversation.title || "Новый разговор"}</span>
            </button>
            <button
              className="icon-button conversation-delete"
              type="button"
              onClick={() => onDelete(conversation)}
              aria-label={`Удалить чат ${conversation.title || "новый разговор"}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </nav>
  );
}
