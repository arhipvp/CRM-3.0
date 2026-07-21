import { ChatBox } from '../../../ChatBox';
import type { ChatMessage, Deal, User } from '../../../../types';

interface ChatTabProps {
  selectedDeal: Deal | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  chatError: string | null;
  currentUser: User | null;
  onSendMessage: (body: string) => Promise<ChatMessage>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onRetryLoad: () => Promise<void>;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  selectedDeal,
  chatMessages,
  isChatLoading,
  chatError,
  currentUser,
  onSendMessage,
  onDeleteMessage,
  onRetryLoad,
}) => {
  if (!selectedDeal) {
    return null;
  }

  return (
    <section className="app-panel p-6 shadow-none space-y-4">
      <div className="flex items-center justify-between">
        <p className="app-label">Чат</p>
      </div>

      {chatError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p>{chatError}</p>
          <button
            type="button"
            className="mt-2 font-semibold underline"
            onClick={() => void onRetryLoad()}
          >
            Повторить
          </button>
        </div>
      ) : isChatLoading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-3 w-1/3 rounded bg-slate-200" />
          <div className="h-3 w-2/3 rounded bg-slate-200" />
          <div className="h-3 w-1/2 rounded bg-slate-200" />
        </div>
      ) : !currentUser ? (
        <p className="text-sm text-slate-600">Нужно войти в систему, чтобы пользоваться чатом.</p>
      ) : (
        <ChatBox
          messages={chatMessages}
          currentUser={currentUser}
          onSendMessage={onSendMessage}
          onDeleteMessage={onDeleteMessage}
        />
      )}
    </section>
  );
};
