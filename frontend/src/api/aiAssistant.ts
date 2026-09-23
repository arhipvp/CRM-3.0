import { request, requestBlob } from './request';

export interface AiConversation {
  id: string;
  title: string;
  created_at: string;
  provider?: string | null;
  model?: string | null;
  scope?: AiScopeBranch[];
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
  run?: AiAnswerRun | null;
}

export type AiRunStatus =
  | 'queued'
  | 'searching'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'stopped'
  | 'interrupted';

export interface AiAnswerRun {
  id: string;
  status: AiRunStatus;
  phase?: string;
  stop_requested?: boolean;
  found_chunks: number;
  created_at: string;
  started_at?: string | null;
  finished_at?: string | null;
  updated_at?: string;
  error?: string | null;
}

export interface AiAnswerSubmission {
  run_id: string;
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
export const updateAiConversationScope = (id: string, scope: AiScopeBranch[]) =>
  request<AiConversation>(`/ai/conversations/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ scope }),
  });
export const deleteAiConversation = (id: string) =>
  request<void>(`/ai/conversations/${id}/`, { method: 'DELETE' });
export const fetchAiMessages = (id: string) =>
  request<AiMessage[]>(`/ai/conversations/${id}/messages/`);
export const submitAiQuestion = (id: string, content: string, clientRequestId: string) =>
  request<AiAnswerSubmission>(`/ai/conversations/${id}/messages/`, {
    method: 'POST',
    body: JSON.stringify({ content, client_request_id: clientRequestId }),
  });
export const stopAiAnswer = (conversationId: string, runId: string) =>
  request<void>(`/ai/conversations/${conversationId}/runs/${runId}/stop/`, { method: 'POST' });
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
export const uploadAiDocuments = (files: File[]) => {
  const body = new FormData();
  files.forEach((file) => body.append('files', file));
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
