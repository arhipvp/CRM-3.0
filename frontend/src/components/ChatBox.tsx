import React, { useEffect, useRef, useState } from 'react';
import { ChatMessage } from '../types';

interface ChatBoxProps {
  messages: ChatMessage[];
  onSendMessage: (authorName: string, body: string) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
}

export const ChatBox: React.FC<ChatBoxProps> = ({ messages, onSendMessage, onDeleteMessage }) => {
  const [newMessage, setNewMessage] = useState('');
  const [authorName, setAuthorName] = useState('Гость');
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Автоскролл к последнему сообщению
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setError(null);
    setSubmitting(true);

    try {
      await onSendMessage(authorName, newMessage.trim());
      setNewMessage('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!confirm('Вы уверены, что хотите удалить это сообщение?')) return;
    try {
      await onDeleteMessage(messageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить сообщение');
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full max-h-96 bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">
            Сообщений нет. Начните разговор!
          </p>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className="bg-white rounded-lg p-3 border border-slate-100 hover:border-slate-200 transition group"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{msg.author_name}</p>
                  <p className="text-sm text-slate-600 mt-1 break-words">{msg.body}</p>
                  <p className="text-xs text-slate-400 mt-2">{formatTime(msg.created_at)}</p>
                </div>
                <button
                  onClick={() => handleDelete(msg.id)}
                  className="text-xs text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 p-4 bg-white space-y-3">
        {error && <p className="text-xs text-red-500 bg-red-50 p-2 rounded">{error}</p>}
        <form onSubmit={handleSendMessage} className="space-y-2">
          <input
            type="text"
            value={authorName}
            onChange={(e) => setAuthorName(e.target.value)}
            placeholder="Ваше имя"
            maxLength={255}
            disabled={isSubmitting}
            className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 focus:border-sky-500 focus:ring-sky-500"
          />
          <div className="flex gap-2">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
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
              {isSubmitting ? '...' : '📤'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
