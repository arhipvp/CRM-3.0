import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapFinancialRecord, mapPayment, mapStatement } from './mappers';
import type { FinancialRecord, Payment, Statement } from '../types';

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

export async function fetchFinancialRecordsWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<FinancialRecord>> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(
    `/financial_records/${qs}`
  );
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList<Record<string, unknown>>(payload).map(mapFinancialRecord),
  };
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

export async function fetchFinanceStatements(filters?: FilterParams): Promise<Statement[]> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/finance_statements/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapStatement);
}

export async function createFinanceStatement(data: {
  name: string;
  statementType: Statement['statementType'];
  counterparty?: string;
  comment?: string;
  recordIds?: string[];
}): Promise<Statement> {
  const payload = await request<Record<string, unknown>>('/finance_statements/', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      statement_type: data.statementType,
      counterparty: data.counterparty || '',
      comment: data.comment || '',
      record_ids: data.recordIds ?? [],
    }),
  });
  return mapStatement(payload);
}

export async function updateFinanceStatement(
  id: string,
  data: Partial<{
    name: string;
    statementType: Statement['statementType'];
    status: Statement['status'];
    counterparty: string;
    comment: string;
    paidAt: string | null;
    recordIds: string[];
  }>
): Promise<Statement> {
  const payload = await request<Record<string, unknown>>(`/finance_statements/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: data.name,
      statement_type: data.statementType,
      status: data.status,
      counterparty: data.counterparty,
      comment: data.comment,
      paid_at: data.paidAt,
      record_ids: data.recordIds,
    }),
  });
  return mapStatement(payload);
}

export async function deleteFinanceStatement(id: string): Promise<void> {
  await request(`/finance_statements/${id}/`, { method: 'DELETE' });
}

export async function removeFinanceStatementRecords(
  id: string,
  recordIds: string[]
): Promise<{ removed: number }> {
  return request<{ removed: number }>(`/finance_statements/${id}/remove-records/`, {
    method: 'POST',
    body: JSON.stringify({ record_ids: recordIds }),
  });
}
