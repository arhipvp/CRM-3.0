import React from 'react';
import { ChatBox } from '../../../ChatBox';
import type { ChatMessage, Deal, User } from '../../../../types';

interface ChatTabProps {
  selectedDeal: Deal | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;
  currentUser: User | null;
  onSendMessage: (body: string) => Promise<void>;
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

  if (isChatLoading) {
    return <p className="text-sm text-slate-500">����㦠�� ᮮ�饭��...</p>;
  }

  if (!currentUser) {
    return (
      <p className="text-sm text-slate-500">Требуется авторизация для чата.</p>
    );
  }

  return (
    <ChatBox
      messages={chatMessages}
      currentUser={currentUser}
      onSendMessage={onSendMessage}
      onDeleteMessage={onDeleteMessage}
    />
  );
};
