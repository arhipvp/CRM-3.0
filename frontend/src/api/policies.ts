import type { Policy, PolicyRecognitionResult } from '../types';
import { request } from './request';
import {
  buildQueryString,
  FilterParams,
  PaginatedResponse,
  toNullableString,
  toOptionalString,
  toStringValue,
  unwrapList,
} from './helpers';
import { mapPolicy } from './mappers';

export async function fetchPolicies(filters?: FilterParams): Promise<Policy[]> {
  const qs = buildQueryString(filters);
  const payload = await request(`/policies/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapPolicy);
}

export async function fetchPoliciesWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Policy>> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/policies/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList<Record<string, unknown>>(payload).map(mapPolicy),
  };
}

export async function createPolicy(data: {
  dealId: string;
  number: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  clientId: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  counterparty?: string;
  salesChannelId?: string;
  startDate?: string | null;
  endDate?: string | null;
}): Promise<Policy> {
  const payload = await request<Record<string, unknown>>('/policies/', {
    method: 'POST',
    body: JSON.stringify({
      deal: data.dealId,
      number: data.number,
      insurance_company: data.insuranceCompanyId,
      insurance_type: data.insuranceTypeId,
      is_vehicle: data.isVehicle,
      brand: data.brand || '',
      model: data.model || '',
      vin: data.vin || '',
      counterparty: data.counterparty || '',
      sales_channel: data.salesChannelId || null,
      start_date: data.startDate || null,
      end_date: data.endDate || null,
      client: data.clientId,
    }),
  });
  return mapPolicy(payload);
}

export async function deletePolicy(id: string): Promise<void> {
  await request(`/policies/${id}/`, { method: 'DELETE' });
}

export async function recognizeDealPolicies(
  dealId: string,
  fileIds: string[]
): Promise<{ results: PolicyRecognitionResult[] }> {
  const payload = await request<{ results?: unknown[] }>('/policies/recognize/', {
    method: 'POST',
    body: JSON.stringify({ deal_id: dealId, file_ids: fileIds }),
  });
  const rawResults = Array.isArray(payload?.results) ? (payload.results as Record<string, unknown>[]) : [];
  return {
    results: rawResults.map((raw) => {
      const item = raw as Record<string, unknown>;
      const statusValue = toStringValue(item.status ?? item.state);
      return {
        fileId: toStringValue(item.fileId ?? item.file_id),
        fileName: toNullableString(item.fileName ?? item.file_name),
        status:
          statusValue === 'parsed'
            ? 'parsed'
            : statusValue === 'exists'
            ? 'exists'
            : 'error',
        message: toOptionalString(item.message),
        transcript: toNullableString(item.transcript ?? item.transcript_text),
        data:
          typeof item.data === 'object' && item.data !== null
            ? (item.data as Record<string, unknown>)
            : undefined,
      };
    }),
  };
}
