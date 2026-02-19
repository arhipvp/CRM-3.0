import { useCallback, useEffect, useState } from 'react';

import type { ActivityLog, ChatMessage } from '../../../../types';
import type { DealTabId } from '../helpers';

interface UseDealCommunicationArgs {
  selectedDealId?: string;
  selectedDealDeletedAt?: string | null;
  activeTab: DealTabId;
  onFetchChatMessages: (dealId: string) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<ChatMessage>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (dealId: string, includeDeleted?: boolean) => Promise<ActivityLog[]>;
}

export const useDealCommunication = ({
  selectedDealId,
  selectedDealDeletedAt,
  activeTab,
  onFetchChatMessages,
  onSendChatMessage,
  onDeleteChatMessage,
  onFetchDealHistory,
}: UseDealCommunicationArgs) => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);

  useEffect(() => {
    setChatMessages([]);
  }, [selectedDealId]);

  const loadChatMessages = useCallback(async () => {
    if (!selectedDealId) {
      return;
    }

    setIsChatLoading(true);
    try {
      const messages = await onFetchChatMessages(selectedDealId);
      setChatMessages(messages);
    } catch (err) {
      console.error('Ошибка загрузки сообщений:', err);
    } finally {
      setIsChatLoading(false);
    }
  }, [onFetchChatMessages, selectedDealId]);

  useEffect(() => {
    if (!selectedDealId) {
      return;
    }
    void loadChatMessages();
  }, [loadChatMessages, selectedDealId]);

  useEffect(() => {
    if (activeTab === 'chat') {
      void loadChatMessages();
    }
  }, [activeTab, loadChatMessages]);

  const handleChatSendMessage = useCallback(
    async (body: string): Promise<ChatMessage> => {
      if (!selectedDealId) {
        throw new Error('Сделка не выбрана');
      }
      const newMessage = await onSendChatMessage(selectedDealId, body);
      setChatMessages((prev) => [...prev, newMessage]);
      return newMessage;
    },
    [onSendChatMessage, selectedDealId],
  );

  const handleChatDelete = useCallback(
    async (messageId: string) => {
      if (!selectedDealId) {
        return;
      }
      await onDeleteChatMessage(messageId);
      setChatMessages((prev) => prev.filter((message) => message.id !== messageId));
    },
    [onDeleteChatMessage, selectedDealId],
  );

  const loadActivityLogs = useCallback(async () => {
    if (!selectedDealId) {
      return;
    }

    setActivityError(null);
    setIsActivityLoading(true);
    try {
      const logs = await onFetchDealHistory(selectedDealId, Boolean(selectedDealDeletedAt));
      setActivityLogs(logs);
    } catch (err) {
      console.error('Ошибка загрузки истории:', err);
      setActivityError('Не удалось загрузить историю.');
    } finally {
      setIsActivityLoading(false);
    }
  }, [onFetchDealHistory, selectedDealDeletedAt, selectedDealId]);

  useEffect(() => {
    if (activeTab === 'history') {
      void loadActivityLogs();
    }
  }, [activeTab, loadActivityLogs]);

  return {
    chatMessages,
    isChatLoading,
    activityLogs,
    isActivityLoading,
    activityError,
    loadChatMessages,
    loadActivityLogs,
    handleChatSendMessage,
    handleChatDelete,
  };
};
