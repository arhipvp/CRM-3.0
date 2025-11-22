import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapActivityLog, mapDeal, mapQuote } from './mappers';
import type { ActivityLog, Deal, DealStatus, Quote } from '../types';

export async function fetchDeals(filters?: FilterParams): Promise<Deal[]> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/deals/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapDeal);
}

export async function fetchDealsWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Deal>> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/deals/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList<Record<string, unknown>>(payload).map(mapDeal),
  };
}

export async function createDeal(data: {
  title: string;
  description?: string;
  clientId: string;
  expectedClose?: string | null;
  executorId?: string | null;
  source?: string;
}): Promise<Deal> {
  const payload = await request<Record<string, unknown>>('/deals/', {
    method: 'POST',
    body: JSON.stringify({
      title: data.title,
      description: data.description,
      client: data.clientId,
      expected_close: data.expectedClose || null,
      executor: data.executorId || null,
      source: data.source?.trim() ?? '',
    }),
  });
  return mapDeal(payload);
}

export async function updateDealStatus(id: string, status: DealStatus): Promise<Deal> {
  const payload = await request<Record<string, unknown>>(`/deals/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  return mapDeal(payload);
}

export async function updateDeal(
  id: string,
  data: {
    title?: string;
    description?: string;
    clientId?: string;
    nextContactDate?: string | null;
    expectedClose?: string | null;
    stageName?: string;
    executorId?: string | null;
    sellerId?: string | null;
    source?: string | null;
  }
): Promise<Deal> {
  const body: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    client: data.clientId,
    next_contact_date: data.nextContactDate || null,
    expected_close: data.expectedClose || null,
    stage_name: data.stageName,
  };
  if ('executorId' in data) {
    body.executor = data.executorId || null;
  }
  if ('sellerId' in data) {
    body.seller = data.sellerId || null;
  }
  if ('source' in data) {
    body.source = data.source ?? null;
  }

  const payload = await request<Record<string, unknown>>(`/deals/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapDeal(payload);
}

export async function deleteDeal(id: string): Promise<void> {
  await request(`/deals/${id}/`, { method: 'DELETE' });
}

export async function restoreDeal(id: string): Promise<Deal> {
  const payload = await request<Record<string, unknown>>(`/deals/${id}/restore/`, {
    method: 'POST',
  });
  return mapDeal(payload);
}

export async function fetchDealHistory(dealId: string, includeDeleted = false): Promise<ActivityLog[]> {
  const suffix = includeDeleted ? '?show_deleted=1' : '';
  const payload = await request(`/deals/${dealId}/history/${suffix}`);
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map(mapActivityLog);
}

export async function createQuote(data: {
  dealId: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  sumInsured: number;
  premium: number;
  deductible?: string;
  comments?: string;
}): Promise<Quote> {
  const payload = await request<Record<string, unknown>>('/quotes/', {
    method: 'POST',
    body: JSON.stringify({
      deal: data.dealId,
      insurance_company: data.insuranceCompanyId,
      insurance_type: data.insuranceTypeId,
      sum_insured: data.sumInsured,
      premium: data.premium,
      deductible: data.deductible,
      comments: data.comments,
    }),
  });
  return mapQuote(payload);
}

export async function updateQuote(
  id: string,
  data: {
    insuranceCompanyId: string;
    insuranceTypeId: string;
    sumInsured: number;
    premium: number;
    deductible?: string;
    comments?: string;
  }
): Promise<Quote> {
  const payload = await request<Record<string, unknown>>(`/quotes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      insurance_company: data.insuranceCompanyId,
      insurance_type: data.insuranceTypeId,
      sum_insured: data.sumInsured,
      premium: data.premium,
      deductible: data.deductible,
      comments: data.comments,
    }),
  });
  return mapQuote(payload);
}

export async function deleteQuote(id: string): Promise<void> {
  await request(`/quotes/${id}/`, { method: 'DELETE' });
}
