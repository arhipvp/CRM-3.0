import type { Policy, PolicyRecognitionResult, SellerDashboardResponse } from '../types';
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
  filters?: FilterParams,
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
  clientId?: string;
  insuredClientId?: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  counterparty?: string;
  salesChannelId?: string;
  startDate?: string | null;
  endDate?: string | null;
  sourceFileId?: string | null;
  sourceFileIds?: string[];
}): Promise<Policy> {
  const bodyPayload: Record<string, unknown> = {
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
    client: data.clientId || null,
    insured_client: data.insuredClientId || null,
  };
  if (data.sourceFileId) {
    bodyPayload.source_file_id = data.sourceFileId;
  }
  if (data.sourceFileIds && data.sourceFileIds.length) {
    bodyPayload.source_file_ids = data.sourceFileIds;
  }
  const payload = await request<Record<string, unknown>>('/policies/', {
    method: 'POST',
    body: JSON.stringify(bodyPayload),
  });
  return mapPolicy(payload);
}

export async function deletePolicy(id: string): Promise<void> {
  await request(`/policies/${id}/`, { method: 'DELETE' });
}

export async function recognizeDealPolicies(
  dealId: string,
  fileIds: string[],
): Promise<{ results: PolicyRecognitionResult[] }> {
  const payload = await request<{ results?: unknown[] }>('/policies/recognize/', {
    method: 'POST',
    body: JSON.stringify({ deal_id: dealId, file_ids: fileIds }),
  });
  const rawResults = Array.isArray(payload?.results)
    ? (payload.results as Record<string, unknown>[])
    : [];
  return {
    results: rawResults.map((raw) => {
      const item = raw as Record<string, unknown>;
      const statusValue = toStringValue(item.status ?? item.state);
      return {
        fileId: toStringValue(item.fileId ?? item.file_id),
        fileName: toNullableString(item.fileName ?? item.file_name),
        status: statusValue === 'parsed' ? 'parsed' : statusValue === 'exists' ? 'exists' : 'error',
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

export async function fetchVehicleBrands(): Promise<string[]> {
  const payload = await request('/policies/vehicle-brands/');
  return unwrapList<string>(payload);
}

export async function fetchVehicleModels(brand?: string): Promise<string[]> {
  const query = brand ? `?brand=${encodeURIComponent(brand)}` : '';
  const payload = await request(`/policies/vehicle-models/${query}`);
  return unwrapList<string>(payload);
}

export async function fetchSellerDashboard(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<SellerDashboardResponse> {
  const searchParams = new URLSearchParams();
  if (params?.startDate) {
    searchParams.set('start_date', params.startDate);
  }
  if (params?.endDate) {
    searchParams.set('end_date', params.endDate);
  }
  const query = searchParams.toString();
  const payload = await request<Record<string, unknown>>(
    `/dashboard/seller/${query ? `?${query}` : ''}`,
  );
  const rawPolicies = Array.isArray(payload.policies) ? payload.policies : [];
  const rawPaymentsByDay = Array.isArray(payload.payments_by_day) ? payload.payments_by_day : [];
  const rawTasksByDay = Array.isArray(payload.tasks_completed_by_day)
    ? payload.tasks_completed_by_day
    : [];
  const rawTasksByExecutor = Array.isArray(payload.tasks_completed_by_executor)
    ? payload.tasks_completed_by_executor
    : [];
  return {
    rangeStart: toStringValue(payload.start_date ?? payload.startDate ?? ''),
    rangeEnd: toStringValue(payload.end_date ?? payload.endDate ?? ''),
    totalPaid: toStringValue(payload.total_paid ?? payload.totalPaid ?? '0'),
    tasksCurrent: Number(payload.tasks_current ?? payload.tasksCurrent ?? 0),
    tasksCompleted: Number(payload.tasks_completed ?? payload.tasksCompleted ?? 0),
    paymentsByDay: rawPaymentsByDay.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        date: toStringValue(record.date),
        total: toStringValue(record.total ?? '0'),
      };
    }),
    tasksCompletedByDay: rawTasksByDay.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        date: toStringValue(record.date),
        count: Number(record.count ?? 0),
      };
    }),
    tasksCompletedByExecutor: rawTasksByExecutor.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        date: toStringValue(record.date),
        executorId: toNullableString(record.executor_id ?? record.executorId),
        executorName: toStringValue(record.executor_name ?? record.executorName ?? 'Неизвестный'),
        count: Number(record.count ?? 0),
      };
    }),
    policies: rawPolicies.map((item) => {
      const record = item as Record<string, unknown>;
      return {
        id: toStringValue(record.id),
        number: toStringValue(record.number),
        insuranceCompany: toStringValue(record.insurance_company ?? record.insuranceCompany ?? ''),
        insuranceType: toStringValue(record.insurance_type ?? record.insuranceType ?? ''),
        clientName: toNullableString(record.client_name ?? record.clientName),
        insuredClientName: toNullableString(record.insured_client_name ?? record.insuredClientName),
        startDate: toNullableString(record.start_date ?? record.startDate),
        paidAmount: toStringValue(record.paid_amount ?? record.paidAmount ?? '0'),
      };
    }),
  };
}
interface PolicyUpdatePayload {
  number: string;
  insuranceCompanyId: string;
  insuranceTypeId: string;
  isVehicle: boolean;
  brand?: string;
  model?: string;
  vin?: string;
  counterparty?: string;
  salesChannelId?: string;
  startDate?: string | null;
  endDate?: string | null;
  insuredClientId?: string;
}

export async function updatePolicy(id: string, data: PolicyUpdatePayload): Promise<Policy> {
  const payload = await request<Record<string, unknown>>(`/policies/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
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
      insured_client: data.insuredClientId || null,
    }),
  });
  return mapPolicy(payload);
}
