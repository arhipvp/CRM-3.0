import { request } from './request';

export interface KnowledgeAskResponse {
  answer: string;
  question: string;
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
