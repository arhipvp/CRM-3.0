import React, { useEffect, useRef, useState } from 'react';
import { User, ChatMessage } from '../types';
import { getUserColor } from '../utils/userColor';
import { Modal } from './Modal';
import { formatErrorMessage } from '../utils/formatErrorMessage';

interface ChatBoxProps {
  messages: ChatMessage[];
  currentUser: User;
  onSendMessage: (body: string) => Promise<ChatMessage>;
  onDeleteMessage: (messageId: string) => Promise<void>;
}

const getUserDisplayName = (user: User) => {
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(' ') : user.username;
};

export const ChatBox: React.FC<ChatBoxProps> = ({
  messages,
  currentUser,
  onSendMessage,
  onDeleteMessage,
}) => {
  const [newMessage, setNewMessage] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [messageToDelete, setMessageToDelete] = useState<ChatMessage | null>(null);
  const [isDeletingMessage, setDeletingMessage] = useState(false);
  const userRoles = currentUser.roles ?? [];
  const isAdmin = userRoles.includes('Admin');

  // Автоскролл к последнему сообщению
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const canDeleteMessage = () => isAdmin;

  const sendMessage = async () => {
    if (isSubmitting || !newMessage.trim()) return;

    setError(null);
    setSubmitting(true);

    try {
      await onSendMessage(newMessage.trim());
      setNewMessage('');
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось отправить сообщение'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMessage();
  };

  const handleTextareaKeyDown = async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      await sendMessage();
    }
  };

  const handleDeleteClick = (message: ChatMessage) => {
    setMessageToDelete(message);
  };

  const handleConfirmDelete = async () => {
    if (!messageToDelete) {
      return;
    }

    setError(null);
    setDeletingMessage(true);

    try {
      await onDeleteMessage(messageToDelete.id);
      setMessageToDelete(null);
    } catch (err) {
      setError(formatErrorMessage(err, 'Не удалось удалить сообщение.'));
    } finally {
      setDeletingMessage(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full min-h-[55vh] max-h-[70vh] w-full bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto bg-slate-50 p-3 space-y-2"
      >
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            Сообщений нет. Начните разговор!
          </p>
        ) : (
          messages.map((msg) => {
            const resolvedAuthorDisplayName =
              msg.author_display_name ??
              msg.author_name ??
              msg.author_username ??
              'Пользователь';
            const authorColor = getUserColor(resolvedAuthorDisplayName);
            const authorName = resolvedAuthorDisplayName;
            const showDeleteButton =
              canDeleteMessage() && msg.showDeleteButton !== false;
            return (
              <div
                key={msg.id}
                className="group flex items-start gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 shadow-sm transition hover:border-slate-200"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className="text-sm font-semibold"
                      style={authorColor ? { color: authorColor } : undefined}
                    >
                      {authorName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {formatTime(msg.created_at)}
                    </p>
                  </div>
                  <p className="text-sm text-slate-600 break-words leading-relaxed">
                    {msg.body}
                  </p>
                </div>
                {showDeleteButton && (
                  <button
                    onClick={() => handleDeleteClick(msg)}
                    className="text-xs text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 bg-white px-4 py-3">
        {error && (
          <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>
        )}
        <form onSubmit={handleSendMessage} className="space-y-2">
          <div className="text-xs text-slate-500">
            Отправляете как <span className="font-semibold text-slate-700">{getUserDisplayName(currentUser)}</span>
          </div>
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Напишите сообщение..."
              rows={2}
              disabled={isSubmitting}
              className="flex-1 text-sm rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:ring-sky-500 resize-none"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newMessage.trim()}
              className="px-3 py-2 text-sm font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:opacity-60 flex-shrink-0"
            >
              {isSubmitting ? '...' : '💬'}
            </button>
          </div>
        </form>
      </div>
      {messageToDelete && (
        <Modal
          title="Подтвердите удаление"
          onClose={() => setMessageToDelete(null)}
          size="sm"
        >
          <p className="text-sm text-slate-700">
            Вы уверены, что хотите удалить это сообщение?
          </p>
          <p className="text-sm text-slate-500 mt-2 break-words">{messageToDelete.body}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMessageToDelete(null)}
              className="px-3 py-2 text-sm font-semibold text-slate-500 border border-slate-200 rounded-lg hover:text-slate-700"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeletingMessage}
              className="px-3 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60"
            >
              {isDeletingMessage ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

