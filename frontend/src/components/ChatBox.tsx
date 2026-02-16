import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage, User } from '../types';
import { formatErrorMessage } from '../utils/formatErrorMessage';
import { getUserColor } from '../utils/userColor';
import { BTN_PRIMARY, BTN_SM_DANGER, BTN_SM_SECONDARY } from './common/buttonStyles';
import { Modal } from './Modal';

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

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }
    container.scrollTop = container.scrollHeight;
  }, [messages]);

  const canDeleteMessage = () => isAdmin;

  const sendMessage = async () => {
    if (isSubmitting || !newMessage.trim()) {
      return;
    }

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

  const handleSendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendMessage();
  };

  const handleTextareaKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
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
    if (!isoString) {
      return '—';
    }
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex h-full min-h-[55vh] max-h-[70vh] w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div ref={messagesContainerRef} className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600">
            Сообщений нет. Начните разговор!
          </p>
        ) : (
          messages.map((message) => {
            const resolvedAuthorDisplayName =
              message.author_display_name ??
              message.author_name ??
              message.author_username ??
              'Пользователь';
            const authorColor = getUserColor(resolvedAuthorDisplayName);
            const showDeleteButton = canDeleteMessage() && message.showDeleteButton !== false;

            return (
              <div
                key={message.id}
                className="group flex items-start gap-3 rounded-xl border border-slate-100 bg-white px-3 py-2 shadow-sm transition hover:border-slate-200"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <p
                      className="text-sm font-semibold"
                      style={authorColor ? { color: authorColor } : undefined}
                    >
                      {resolvedAuthorDisplayName}
                    </p>
                    <p className="text-[11px] text-slate-400">{formatTime(message.created_at)}</p>
                  </div>
                  <p className="break-words text-sm leading-relaxed text-slate-700">
                    {message.body}
                  </p>
                </div>

                {showDeleteButton && (
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(message)}
                    className="icon-btn h-7 w-7 text-rose-600 hover:bg-rose-50 opacity-0 transition group-hover:opacity-100"
                    aria-label="Удалить сообщение"
                    title="Удалить сообщение"
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-3">
        {error && <p className="app-alert app-alert-danger">{error}</p>}

        <form onSubmit={handleSendMessage} className="space-y-2">
          <div className="text-xs text-slate-600">
            Отправляете как{' '}
            <span className="font-semibold text-slate-900">{getUserDisplayName(currentUser)}</span>
          </div>

          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(event) => setNewMessage(event.target.value)}
              onKeyDown={handleTextareaKeyDown}
              placeholder="Напишите сообщение..."
              rows={2}
              disabled={isSubmitting}
              className="field-textarea flex-1 resize-none"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newMessage.trim()}
              className={`${BTN_PRIMARY} flex-shrink-0`}
            >
              {isSubmitting ? '...' : 'Отправить'}
            </button>
          </div>
        </form>
      </div>

      {messageToDelete && (
        <Modal title="Подтвердите удаление" onClose={() => setMessageToDelete(null)} size="sm">
          <p className="text-sm text-slate-700">Вы уверены, что хотите удалить это сообщение?</p>
          <p className="mt-2 break-words text-sm text-slate-600">{messageToDelete.body}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setMessageToDelete(null)}
              className={BTN_SM_SECONDARY}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleConfirmDelete}
              disabled={isDeletingMessage}
              className={BTN_SM_DANGER}
            >
              {isDeletingMessage ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};
