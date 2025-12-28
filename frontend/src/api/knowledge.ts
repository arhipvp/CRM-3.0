import {
  mapKnowledgeChatSession,
  mapKnowledgeNotebook,
  mapKnowledgeSavedAnswer,
  mapKnowledgeSource,
  mapKnowledgeSourceDetail,
} from './mappers';
import { request } from './request';
import type {
  KnowledgeCitation,
  KnowledgeChatSession,
  KnowledgeNotebook,
  KnowledgeSavedAnswer,
  KnowledgeSource,
  KnowledgeSourceDetail,
} from '../types';

export interface KnowledgeAskResponse {
  answer: string;
  question: string;
  citations?: KnowledgeCitation[];
}

export async function askKnowledgeBase(
  notebookId: string,
  question: string,
  sessionId?: string
): Promise<KnowledgeAskResponse> {
  return request<KnowledgeAskResponse>('/knowledge/ask/', {
    method: 'POST',
    body: JSON.stringify({
      notebook_id: notebookId,
      question,
      session_id: sessionId,
    }),
  });
}

export async function fetchNotebooks(): Promise<KnowledgeNotebook[]> {
  const data = await request<Record<string, unknown>[]>('/knowledge/notebooks/');
  return data.map(mapKnowledgeNotebook);
}

export async function createNotebook(payload: {
  name: string;
  description?: string;
}): Promise<KnowledgeNotebook> {
  const response = await request<Record<string, unknown>>(
    '/knowledge/notebooks/',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return mapKnowledgeNotebook(response);
}

export async function updateNotebook(payload: {
  notebookId: string;
  name?: string;
  description?: string;
}): Promise<KnowledgeNotebook> {
  const response = await request<Record<string, unknown>>(
    `/knowledge/notebooks/${payload.notebookId}/`,
    {
      method: 'PUT',
      body: JSON.stringify({
        name: payload.name,
        description: payload.description,
      }),
    }
  );
  return mapKnowledgeNotebook(response);
}

export async function deleteNotebook(notebookId: string): Promise<void> {
  await request<void>(`/knowledge/notebooks/${notebookId}/`, {
    method: 'DELETE',
  });
}

export async function fetchSources(
  notebookId: string
): Promise<KnowledgeSource[]> {
  const data = await request<Record<string, unknown>[]>(
    `/knowledge/sources/?notebook_id=${encodeURIComponent(notebookId)}`
  );
  return data.map(mapKnowledgeSource);
}

export async function fetchSourceDetail(
  sourceId: string
): Promise<KnowledgeSourceDetail> {
  const data = await request<Record<string, unknown>>(
    `/knowledge/sources/${sourceId}/`
  );
  return mapKnowledgeSourceDetail(data);
}

export async function fetchChatSessions(
  notebookId: string
): Promise<KnowledgeChatSession[]> {
  const data = await request<Record<string, unknown>[]>(
    `/knowledge/chat/sessions/?notebook_id=${encodeURIComponent(notebookId)}`
  );
  return data.map(mapKnowledgeChatSession);
}

export async function createChatSession(payload: {
  notebookId: string;
  title?: string;
}): Promise<KnowledgeChatSession> {
  const response = await request<Record<string, unknown>>(
    '/knowledge/chat/sessions/',
    {
      method: 'POST',
      body: JSON.stringify({
        notebook_id: payload.notebookId,
        title: payload.title,
      }),
    }
  );
  return mapKnowledgeChatSession(response);
}

export async function updateChatSession(payload: {
  sessionId: string;
  title: string;
}): Promise<KnowledgeChatSession> {
  const response = await request<Record<string, unknown>>(
    `/knowledge/chat/sessions/${payload.sessionId}/`,
    {
      method: 'PUT',
      body: JSON.stringify({ title: payload.title }),
    }
  );
  return mapKnowledgeChatSession(response);
}

export async function deleteChatSession(sessionId: string): Promise<void> {
  await request<void>(`/knowledge/chat/sessions/${sessionId}/`, {
    method: 'DELETE',
  });
}

export async function uploadSource(payload: {
  notebookId: string;
  title?: string;
  file: File;
}): Promise<void> {
  const formData = new FormData();
  formData.append('notebook_id', payload.notebookId);
  if (payload.title) {
    formData.append('title', payload.title);
  }
  formData.append('file', payload.file);
  await request<void>('/knowledge/sources/', {
    method: 'POST',
    body: formData,
  });
}

export async function deleteSource(sourceId: string): Promise<void> {
  await request<void>(`/knowledge/sources/${sourceId}/`, {
    method: 'DELETE',
  });
}

export async function fetchSavedAnswers(
  notebookId: string
): Promise<KnowledgeSavedAnswer[]> {
  const data = await request<Record<string, unknown>[]>(
    `/knowledge/notes/?notebook_id=${encodeURIComponent(notebookId)}`
  );
  return data.map(mapKnowledgeSavedAnswer);
}

export async function saveKnowledgeAnswer(payload: {
  notebookId: string;
  question: string;
  answer: string;
}): Promise<KnowledgeSavedAnswer> {
  const response = await request<Record<string, unknown>>('/knowledge/notes/', {
    method: 'POST',
    body: JSON.stringify({
      notebook_id: payload.notebookId,
      question: payload.question,
      answer: payload.answer,
    }),
  });
  return mapKnowledgeSavedAnswer(response);
}

export async function deleteKnowledgeAnswer(answerId: string): Promise<void> {
  await request<void>(`/knowledge/notes/${answerId}/`, {
    method: 'DELETE',
  });
}
