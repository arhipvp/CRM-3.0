import { mapKnowledgeSavedAnswer } from './mappers';
import { request } from './request';
import type { KnowledgeCitation, KnowledgeSavedAnswer } from '../types';

export interface KnowledgeAskResponse {
  answer: string;
  question: string;
  citations?: KnowledgeCitation[];
}

export async function askKnowledgeBase(
  insuranceTypeId: string,
  question: string
): Promise<KnowledgeAskResponse> {
  return request<KnowledgeAskResponse>('/knowledge/ask/', {
    method: 'POST',
    body: JSON.stringify({
      insurance_type: insuranceTypeId,
      question,
    }),
  });
}

export async function fetchSavedAnswers(
  insuranceTypeId: string
): Promise<KnowledgeSavedAnswer[]> {
  const data = await request<Record<string, unknown>[]>(
    `/knowledge_saved_answers/?insurance_type=${encodeURIComponent(insuranceTypeId)}`
  );
  return data.map(mapKnowledgeSavedAnswer);
}

export async function saveKnowledgeAnswer(payload: {
  insuranceTypeId: string;
  question: string;
  answer: string;
  citations?: KnowledgeCitation[];
}): Promise<KnowledgeSavedAnswer> {
  const response = await request<Record<string, unknown>>(
    '/knowledge_saved_answers/',
    {
      method: 'POST',
      body: JSON.stringify({
        insurance_type: payload.insuranceTypeId,
        question: payload.question,
        answer: payload.answer,
        citations: payload.citations ?? [],
      }),
    }
  );
  return mapKnowledgeSavedAnswer(response);
}

export async function deleteKnowledgeAnswer(answerId: string): Promise<void> {
  await request<void>(`/knowledge_saved_answers/${answerId}/`, {
    method: 'DELETE',
  });
}
