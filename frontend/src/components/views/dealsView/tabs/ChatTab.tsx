import { ChatBox } from '../../../ChatBox';
import type { ChatMessage, Deal, User } from '../../../../types';

interface ChatTabProps {
  selectedDeal: Deal | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  currentUser: User | null;
  onSendMessage: (body: string) => Promise<ChatMessage>;
  onDeleteMessage: (messageId: string) => Promise<void>;
}

export const ChatTab: React.FC<ChatTabProps> = ({
  selectedDeal,
  chatMessages,
  isChatLoading,
  currentUser,
  onSendMessage,
  onDeleteMessage,
}) => {
  if (!selectedDeal) {
    return null;
  }

  return (
    <section className="app-panel p-6 shadow-none">
      <div className="mb-4 flex items-center justify-between">
        <p className="app-label">Чат</p>
        <p className="text-xs text-slate-500">{selectedDeal.title}</p>
      </div>

      {isChatLoading ? (
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
