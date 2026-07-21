import { useCallback, useEffect, useRef, useState } from 'react';

import type { ActivityLog, ChatMessage, DealTimelineEvent } from '../../../../types';
import type { DealTabId } from '../helpers';

interface UseDealCommunicationArgs {
  selectedDealId?: string;
  selectedDealDeletedAt?: string | null;
  activeTab: DealTabId;
  onFetchChatMessages: (dealId: string, options?: RequestInit) => Promise<ChatMessage[]>;
  onSendChatMessage: (dealId: string, body: string) => Promise<ChatMessage>;
  onDeleteChatMessage: (messageId: string) => Promise<void>;
  onFetchDealHistory: (
    dealId: string,
    includeDeleted?: boolean,
    options?: RequestInit,
  ) => Promise<ActivityLog[]>;
  onFetchDealEvents: (
    dealId: string,
    includeDeleted?: boolean,
    options?: RequestInit,
  ) => Promise<DealTimelineEvent[]>;
  dealEventsRefreshToken?: number;
}

export const useDealCommunication = ({
  selectedDealId,
  selectedDealDeletedAt,
  activeTab,
  onFetchChatMessages,
  onSendChatMessage,
  onDeleteChatMessage,
  onFetchDealHistory,
  onFetchDealEvents,
  dealEventsRefreshToken = 0,
}: UseDealCommunicationArgs) => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isActivityLoading, setIsActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [dealTimelineEvents, setDealTimelineEvents] = useState<DealTimelineEvent[]>([]);
  const [isDealEventsLoading, setIsDealEventsLoading] = useState(false);
  const [dealEventsError, setDealEventsError] = useState<string | null>(null);
  const previousDealEventsRefresh = useRef<{
    dealId?: string;
    token: number;
  }>({ token: dealEventsRefreshToken });
  const chatAbortControllerRef = useRef<AbortController | null>(null);
  const eventsAbortControllerRef = useRef<AbortController | null>(null);

  const isAbortError = (error: unknown) =>
    error instanceof DOMException && error.name === 'AbortError';

  useEffect(() => {
    setChatMessages([]);
    setChatError(null);
    setActivityLogs([]);
    setActivityError(null);
    setDealTimelineEvents([]);
    setDealEventsError(null);
  }, [selectedDealId]);

  const loadChatMessages = useCallback(async () => {
    if (!selectedDealId) {
      return;
    }

    chatAbortControllerRef.current?.abort();
    const controller = new AbortController();
    chatAbortControllerRef.current = controller;
    setChatError(null);
    setIsChatLoading(true);
    try {
      const messages = await onFetchChatMessages(selectedDealId, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setChatMessages(messages);
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.error('Ошибка загрузки сообщений:', err);
        setChatError('Не удалось загрузить сообщения.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsChatLoading(false);
      }
    }
  }, [onFetchChatMessages, selectedDealId]);

  useEffect(() => {
    if (activeTab !== 'chat' || !selectedDealId) {
      return;
    }
    void loadChatMessages();
    return () => chatAbortControllerRef.current?.abort();
  }, [activeTab, loadChatMessages, selectedDealId]);

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

  const loadDealEvents = useCallback(async () => {
    if (!selectedDealId) {
      return;
    }

    eventsAbortControllerRef.current?.abort();
    const controller = new AbortController();
    eventsAbortControllerRef.current = controller;
    setDealEventsError(null);
    setIsDealEventsLoading(true);
    try {
      const events = await onFetchDealEvents(selectedDealId, Boolean(selectedDealDeletedAt), {
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setDealTimelineEvents(events);
      }
    } catch (err) {
      if (!isAbortError(err)) {
        console.error('Ошибка загрузки ленты:', err);
        setDealEventsError('Не удалось загрузить ленту.');
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsDealEventsLoading(false);
      }
    }
  }, [onFetchDealEvents, selectedDealDeletedAt, selectedDealId]);

  useEffect(() => {
    if (activeTab !== 'events' || !selectedDealId) {
      return;
    }
    void loadDealEvents();
    return () => eventsAbortControllerRef.current?.abort();
  }, [activeTab, loadDealEvents, selectedDealId]);

  useEffect(() => {
    const previous = previousDealEventsRefresh.current;
    previousDealEventsRefresh.current = {
      dealId: selectedDealId,
      token: dealEventsRefreshToken,
    };

    if (
      !selectedDealId ||
      dealEventsRefreshToken === 0 ||
      previous.dealId !== selectedDealId ||
      previous.token === dealEventsRefreshToken
    ) {
      return;
    }
    void loadDealEvents();
  }, [dealEventsRefreshToken, loadDealEvents, selectedDealId]);

  useEffect(() => {
    if (activeTab === 'history') {
      void loadActivityLogs();
    }
  }, [activeTab, loadActivityLogs]);

  return {
    chatMessages,
    isChatLoading,
    chatError,
    activityLogs,
    isActivityLoading,
    activityError,
    dealTimelineEvents,
    isDealEventsLoading,
    dealEventsError,
    loadChatMessages,
    loadActivityLogs,
    loadDealEvents,
    handleChatSendMessage,
    handleChatDelete,
  };
};
