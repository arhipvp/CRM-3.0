import { API_BASE, getAccessToken, request, requestBlob } from './request';

export interface AiConversation {
  id: string;
  title: string;
  created_at: string;
  provider?: string | null;
  model?: string | null;
}

export interface AiProvider {
  id: string;
  label: string;
  available: boolean;
  models: string[];
  default_model?: string | null;
  billing: string;
  error?: string;
}

export interface AiProvidersResponse {
  providers: AiProvider[];
}

export interface AiCitation {
  document_id: string;
  filename: string;
  location: Record<string, string | number>;
  score?: number;
  classification?: AiClassification | null;
}

export interface AiClassification {
  insurer?: string | null;
  insurance_kind?: string | null;
  product?: string | null;
  document_type?: string | null;
  effective_from?: string | null;
  effective_to?: string | null;
}

export interface AiScopeBranch {
  insurer?: string;
  insurance_kind?: string;
  product?: string;
  unclassified?: boolean;
}

export interface AiCatalogProduct {
  name: string;
  count: number;
}

export interface AiCatalogKind {
  name: string;
  count: number;
  products: AiCatalogProduct[];
}

export interface AiCatalogInsurer {
  name: string;
  count: number;
  kinds: AiCatalogKind[];
}

export interface AiCatalog {
  total: number;
  unclassified: number;
  insurers: AiCatalogInsurer[];
  suggestions: {
    insurers: string[];
    insurance_kinds: string[];
    products: string[];
  };
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
  classification?: AiClassification;
}

export const fetchAiConversations = () => request<AiConversation[]>('/ai/conversations/');
export const createAiConversation = (title = 'Новый чат') =>
  request<AiConversation>('/ai/conversations/', {
    method: 'POST',
    body: JSON.stringify({ title }),
  });
export const updateAiConversationModel = (id: string, provider: string, model: string) =>
  request<AiConversation>(`/ai/conversations/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ provider, model }),
  });
export const deleteAiConversation = (id: string) =>
  request<void>(`/ai/conversations/${id}/`, { method: 'DELETE' });
export const fetchAiMessages = (id: string) =>
  request<AiMessage[]>(`/ai/conversations/${id}/messages/`);
export const fetchAiDocuments = () => request<AiDocument[]>('/ai/documents/');
export const fetchAiCatalog = () => request<AiCatalog>('/ai/catalog/');
export const fetchAiProviders = () => request<AiProvidersResponse>('/ai/providers/');
export const deleteAiDocument = (id: string) =>
  request<void>(`/ai/documents/${id}/`, { method: 'DELETE' });
export const updateAiDocumentClassification = (
  documentIds: string[],
  classification: AiClassification,
) =>
  request<AiDocument[]>('/ai/documents/classification/', {
    method: 'PATCH',
    body: JSON.stringify({ document_ids: documentIds, ...classification }),
  });
export const uploadAiDocuments = (files: File[], classification: AiClassification = {}) => {
  const body = new FormData();
  files.forEach((file) => body.append('files', file));
  Object.entries(classification).forEach(([key, value]) => {
    if (value) body.append(key, value);
  });
  return request<AiDocument[]>('/ai/documents/', { method: 'POST', body });
};

export function aiDocumentPageFragment(location?: AiCitation['location']): string {
  return typeof location?.page === 'number' && location.page > 0 ? `#page=${location.page}` : '';
}

export async function fetchAiDocumentContent(documentId: string): Promise<string> {
  try {
    const blob = await requestBlob(`/ai/documents/${documentId}/content/`);
    return URL.createObjectURL(blob);
  } catch {
    throw new Error('Не удалось открыть источник. Попробуйте ещё раз позже.');
  }
}

export async function streamAiAnswer(
  conversationId: string,
  content: string,
  scope: AiScopeBranch[],
  onEvent: (event: string, payload: unknown) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}/ai/conversations/${conversationId}/messages/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
    },
    body: JSON.stringify({ content, scope }),
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
