import { request } from './request';
import { unwrapList } from './helpers';
import { mapChatMessage } from './mappers';
import type { ChatMessage } from '../types';

export async function fetchChatMessages(dealId: string): Promise<ChatMessage[]> {
  const payload = await request(`/chat_messages/?deal=${dealId}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapChatMessage);
}

export async function createChatMessage(dealId: string, body: string): Promise<ChatMessage> {
  const payload = await request<Record<string, unknown>>('/chat_messages/', {
    method: 'POST',
    body: JSON.stringify({
      deal: dealId,
      body,
    }),
  });
  return mapChatMessage(payload);
}

export async function deleteChatMessage(id: string): Promise<void> {
  await request(`/chat_messages/${id}/`, { method: 'DELETE' });
}
