import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapFinancialRecord, mapPayment } from './mappers';
import type { FinancialRecord, Payment } from '../types';

export async function fetchPayments(filters?: FilterParams): Promise<Payment[]> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/payments/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapPayment);
}

export async function fetchPaymentsWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Payment>> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/payments/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList<Record<string, unknown>>(payload).map(mapPayment),
  };
}

export async function createPayment(data: {
  dealId?: string;
  policyId?: string;
  amount: number;
  description?: string;
  scheduledDate?: string | null;
  actualDate?: string | null;
}): Promise<Payment> {
  const payload = await request<Record<string, unknown>>('/payments/', {
    method: 'POST',
    body: JSON.stringify({
      deal: data.dealId || null,
      policy: data.policyId || null,
      amount: data.amount,
      description: data.description || '',
      scheduled_date: data.scheduledDate || null,
      actual_date: data.actualDate || null,
    }),
  });
  return mapPayment(payload);
}

export async function updatePayment(
  id: string,
  data: Partial<{
    dealId: string;
    policyId: string;
    actualDate: string | null;
    scheduledDate: string | null;
    description: string;
    amount: number;
  }>
): Promise<Payment> {
  const payload = await request<Record<string, unknown>>(`/payments/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      deal: data.dealId,
      policy: data.policyId,
      actual_date: data.actualDate,
      scheduled_date: data.scheduledDate,
      description: data.description,
      amount: data.amount,
    }),
  });
  return mapPayment(payload);
}

export async function fetchFinancialRecords(): Promise<FinancialRecord[]> {
  const payload = await request<Record<string, unknown>>('/financial_records/');
  return unwrapList<Record<string, unknown>>(payload).map(mapFinancialRecord);
}

export async function createFinancialRecord(data: {
  paymentId: string;
  amount: number;
  date?: string | null;
  description?: string;
  source?: string;
  note?: string;
}): Promise<FinancialRecord> {
  const payload = await request<Record<string, unknown>>('/financial_records/', {
    method: 'POST',
    body: JSON.stringify({
      payment: data.paymentId,
      amount: data.amount,
      date: data.date || null,
      description: data.description || '',
      source: data.source || '',
      note: data.note || '',
    }),
  });
  return mapFinancialRecord(payload);
}

export async function updateFinancialRecord(
  id: string,
  data: Partial<{
    amount: number;
    date: string | null;
    description: string;
    source: string;
    note: string;
  }>
): Promise<FinancialRecord> {
  const payload = await request<Record<string, unknown>>(`/financial_records/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      amount: data.amount,
      date: data.date,
      description: data.description,
      source: data.source,
      note: data.note,
    }),
  });
  return mapFinancialRecord(payload);
}

export async function deleteFinancialRecord(id: string): Promise<void> {
  await request(`/financial_records/${id}/`, { method: 'DELETE' });
}
