import { API_BASE, getAccessToken, request } from './request';

export interface AiConversation {
  id: string;
  title: string;
  created_at: string;
}

export interface AiCitation {
  document_id: string;
  filename: string;
  location: Record<string, string | number>;
  score?: number;
}

export function formatAiCitationLocation(location: AiCitation['location']): string {
  if ('page' in location) return `страница ${location.page}`;
  if ('sheet' in location) return `лист ${location.sheet}`;
  if ('slide' in location) return `слайд ${location.slide}`;
  if ('attachment_name' in location) return `вложение ${location.attachment_name}`;
  return String(location.label ?? 'фрагмент');
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations: AiCitation[];
  usage?: { provider: string; model: string; cost_rub?: number | null };
}

export interface AiDocument {
  id: string;
  filename: string;
  status: string;
  chunks: number;
  error?: string | null;
}

export const fetchAiConversations = () => request<AiConversation[]>('/ai/conversations/');
export const createAiConversation = (title = 'Новый чат') =>
  request<AiConversation>('/ai/conversations/', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
export const deleteAiConversation = (id: string) =>
  request<void>(`/ai/conversations/${id}/`, { method: 'DELETE' });
export const fetchAiMessages = (id: string) =>
  request<AiMessage[]>(`/ai/conversations/${id}/messages/`);
export const fetchAiDocuments = () => request<AiDocument[]>('/ai/documents/');
export const deleteAiDocument = (id: string) =>
  request<void>(`/ai/documents/${id}/`, { method: 'DELETE' });
export const uploadAiDocuments = (files: File[]) => {
  const body = new FormData();
  files.forEach((file) => body.append('files', file));
  return request<AiDocument[]>('/ai/documents/', { method: 'POST', body });
};

export async function streamAiAnswer(
  conversationId: string,
  content: string,
  onEvent: (event: string, payload: unknown) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/ai/conversations/${conversationId}/messages/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    body: JSON.stringify({ content, provider: 'polza' }),
  });
  if (!response.ok || !response.body)
    throw new Error('Не удалось получить ответ страхового помощника.');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  for (;;) {
    const { done, value } = await reader.read();
    pending += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let boundary = pending.indexOf('\n\n');
    while (boundary >= 0) {
      const packet = pending.slice(0, boundary);
      pending = pending.slice(boundary + 2);
      const event = packet.match(/^event:\s*(.+)$/m)?.[1] ?? 'message';
      const data = packet.match(/^data:\s*(.+)$/m)?.[1];
      if (data) {
        try {
          onEvent(event, JSON.parse(data));
        } catch {
          onEvent(event, data);
        }
      }
      boundary = pending.indexOf('\n\n');
    }
    if (done) break;
  }
}
