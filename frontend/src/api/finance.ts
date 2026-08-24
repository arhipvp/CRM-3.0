import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapDriveFile, mapFinancialRecord, mapPayment, mapStatement } from './mappers';
import type {
  FinancialRecord,
  Payment,
  Statement,
  StatementAmountApplyMode,
  StatementAmountApplyResult,
  DriveFile,
} from '../types';

const FINANCE_PAGE_SIZE = 200;

interface FinanceExportJob {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  result?: { file?: Record<string, unknown> } | null;
  error?: string | null;
}

export const waitForFinanceExport = async (jobId: string): Promise<DriveFile> => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const job = await request<FinanceExportJob>(`/external-jobs/${jobId}/`);
    if (job.status === 'succeeded' && job.result?.file) {
      return mapDriveFile(job.result.file);
    }
    if (job.status === 'failed') {
      throw new Error(job.error || 'Не удалось сформировать финансовую выгрузку.');
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('Превышено время ожидания финансовой выгрузки.');
};

async function fetchAllPages<T>(
  path: string,
  mapper: (item: Record<string, unknown>) => T,
  filters?: FilterParams,
  options?: RequestInit,
): Promise<T[]> {
  let page = 1;
  const aggregated: T[] = [];

  while (true) {
    const qs = buildQueryString({
      ...(filters ?? {}),
      page,
      page_size: FINANCE_PAGE_SIZE,
    });
    const payload = await request<PaginatedResponse<Record<string, unknown>>>(
      `${path}${qs}`,
      options,
    );
    aggregated.push(...unwrapList<Record<string, unknown>>(payload).map(mapper));
    if (!payload.next) {
      break;
    }
    page += 1;
  }

  return aggregated;
}

export async function fetchPayments(filters?: FilterParams): Promise<Payment[]> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/payments/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapPayment);
}

export async function fetchPaymentsWithPagination(
  filters?: FilterParams,
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
  incomes?: Array<{
    amount: number;
    date?: string | null;
    description?: string;
    source?: string;
    note?: string;
  }>;
  expenses?: Array<{
    amount: number;
    date?: string | null;
    description?: string;
    source?: string;
    note?: string;
  }>;
  initialRecord?: {
    amount: number;
    recordType: 'income' | 'expense';
    date?: string | null;
    description?: string;
    source?: string;
    note?: string;
  };
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
      incomes: data.incomes?.map((record) => ({
        amount: record.amount,
        date: record.date || null,
        description: record.description || '',
        source: record.source || '',
        note: record.note || '',
      })),
      expenses: data.expenses?.map((record) => ({
        amount: record.amount,
        date: record.date || null,
        description: record.description || '',
        source: record.source || '',
        note: record.note || '',
      })),
      initial_record: data.initialRecord
        ? {
            amount: data.initialRecord.amount,
            record_type: data.initialRecord.recordType,
            date: data.initialRecord.date || null,
            description: data.initialRecord.description || '',
            source: data.initialRecord.source || '',
            note: data.initialRecord.note || '',
          }
        : undefined,
    }),
  });
  return mapPayment(payload);
}

export async function deletePayment(id: string): Promise<void> {
  await request(`/payments/${id}/`, { method: 'DELETE' });
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
  }>,
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
  return fetchAllPages('/financial_records/', mapFinancialRecord);
}

export async function fetchStatementFinancialRecords(
  statementId: string,
  options?: RequestInit,
): Promise<FinancialRecord[]> {
  return fetchAllPages(
    '/financial_records/',
    mapFinancialRecord,
    { statement: statementId },
    options,
  );
}

export async function fetchStatementFinancialRecordsWithPagination(
  statementId: string,
  filters?: FilterParams,
  options?: RequestInit,
): Promise<PaginatedResponse<FinancialRecord>> {
  return fetchFinancialRecordsWithPagination(
    {
      ...(filters ?? {}),
      statement: statementId,
    },
    options,
  );
}

export async function fetchFinancialRecordsWithPagination(
  filters?: FilterParams,
  options?: RequestInit,
): Promise<PaginatedResponse<FinancialRecord>> {
  const qs = buildQueryString(filters);
  const payload = await request<
    PaginatedResponse<Record<string, unknown>> & {
      payment_summaries?: Record<string, { paid_balance?: unknown; paid_entries?: unknown }>;
    }
  >(`/financial_records/${qs}`, options);
  const rows = unwrapList<Record<string, unknown>>(payload).map((row) => {
    const paymentId = String(row.payment ?? '');
    const summary = payload.payment_summaries?.[paymentId];
    return summary
      ? {
          ...row,
          payment_paid_balance: summary.paid_balance,
          payment_paid_entries: Array.isArray(summary.paid_entries) ? summary.paid_entries : [],
        }
      : row;
  });
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: rows.map(mapFinancialRecord),
  };
}

export interface FinancialRecordsSummary {
  recordsCount: number;
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  unpaidRecordsCount: number;
  withoutStatementCount: number;
  paymentsPaidBalanceTotal: number;
}

export async function fetchFinancialRecordsSummary(
  filters?: FilterParams,
  options?: RequestInit,
): Promise<FinancialRecordsSummary> {
  const payload = await request<Record<string, unknown>>(
    `/financial_records/summary/${buildQueryString(filters)}`,
    options,
  );
  return {
    recordsCount: Number(payload.records_count ?? 0),
    incomeTotal: Number(payload.income_total ?? 0),
    expenseTotal: Number(payload.expense_total ?? 0),
    netTotal: Number(payload.net_total ?? 0),
    unpaidRecordsCount: Number(payload.unpaid_records_count ?? 0),
    withoutStatementCount: Number(payload.without_statement_count ?? 0),
    paymentsPaidBalanceTotal: Number(payload.payments_paid_balance_total ?? 0),
  };
}

export async function exportFinancialRecordsXlsx(filters?: FilterParams): Promise<DriveFile> {
  const qs = buildQueryString(filters);
  const job = await request<FinanceExportJob>(`/financial_records/export-xlsx/${qs}`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return waitForFinanceExport(job.id);
}
export async function createFinancialRecord(data: {
  paymentId: string;
  amount: number;
  recordType?: 'income' | 'expense';
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
      record_type: data.recordType,
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
    recordType: 'income' | 'expense';
    date: string | null;
    description: string;
    source: string;
    note: string;
  }>,
): Promise<FinancialRecord> {
  const payload = await request<Record<string, unknown>>(`/financial_records/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      amount: data.amount,
      record_type: data.recordType,
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

export async function fetchFinanceStatements(
  filters?: FilterParams,
  options?: RequestInit,
): Promise<Statement[]> {
  return fetchAllPages('/finance_statements/', mapStatement, filters, options);
}

export async function fetchFinanceStatementsWithPagination(
  filters?: FilterParams,
  options?: RequestInit,
): Promise<PaginatedResponse<Statement>> {
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(
    `/finance_statements/${buildQueryString({ page_size: 50, ...(filters ?? {}) })}`,
    options,
  );
  return { ...payload, results: payload.results.map(mapStatement) };
}

export interface FinanceStatementLookupOption {
  id: string;
  name: string;
  statementType: Statement['statementType'];
  paidAt: string | null;
}

export async function fetchFinanceStatementLookup(
  search = '',
  statementType?: Statement['statementType'],
  options?: RequestInit,
): Promise<FinanceStatementLookupOption[]> {
  const payload = await request<{ results: Record<string, unknown>[] }>(
    `/finance_statements/lookup/${buildQueryString({
      search: search.trim() || undefined,
      statement_type: statementType,
      paid: false,
      page_size: 50,
    })}`,
    options,
  );
  return payload.results.map((row) => ({
    id: String(row.id),
    name: String(row.name ?? ''),
    statementType: row.statement_type as Statement['statementType'],
    paidAt: row.paid_at ? String(row.paid_at) : null,
  }));
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
  }>,
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

export type AttachFinanceStatementRecordsResult = {
  statement: Statement;
  attachedRecordIds: string[];
};

export async function attachFinanceStatementRecords(
  id: string,
  recordIds: string[],
): Promise<AttachFinanceStatementRecordsResult> {
  const payload = await request<Record<string, unknown>>(
    `/finance_statements/${id}/attach-records/`,
    {
      method: 'POST',
      body: JSON.stringify({ record_ids: recordIds }),
    },
  );
  const rawStatement =
    typeof payload.statement === 'object' && payload.statement !== null
      ? (payload.statement as Record<string, unknown>)
      : payload;
  const rawRecordIds = payload.attached_record_ids ?? payload.attachedRecordIds ?? [];
  return {
    statement: mapStatement(rawStatement),
    attachedRecordIds: Array.isArray(rawRecordIds)
      ? rawRecordIds.filter((id): id is string => typeof id === 'string')
      : [],
  };
}

export async function deleteFinanceStatement(id: string): Promise<void> {
  await request(`/finance_statements/${id}/`, { method: 'DELETE' });
}

export async function removeFinanceStatementRecords(
  id: string,
  recordIds: string[],
): Promise<{ removed: number }> {
  return request<{ removed: number }>(`/finance_statements/${id}/remove-records/`, {
    method: 'POST',
    body: JSON.stringify({ record_ids: recordIds }),
  });
}

export async function applyFinanceStatementAmount(
  id: string,
  data: { mode: StatementAmountApplyMode; value: string },
): Promise<StatementAmountApplyResult> {
  const payload = await request<Record<string, unknown>>(
    `/finance_statements/${id}/apply-amount/`,
    {
      method: 'POST',
      body: JSON.stringify({
        mode: data.mode,
        value: data.value,
      }),
    },
  );
  const skippedReasons = (payload.skipped_reasons ?? payload.skippedReasons ?? {}) as Record<
    string,
    unknown
  >;
  const rawRecords = Array.isArray(payload.records) ? payload.records : [];
  const rawStatement =
    typeof payload.statement === 'object' && payload.statement !== null
      ? (payload.statement as Record<string, unknown>)
      : {};
  return {
    updated: Number(payload.updated ?? 0),
    unchanged: Number(payload.unchanged ?? 0),
    skipped: Number(payload.skipped ?? 0),
    skippedReasons: {
      zeroBalance: Number(skippedReasons.zero_balance ?? skippedReasons.zeroBalance ?? 0),
    },
    records: rawRecords.map((record) => mapFinancialRecord(record as Record<string, unknown>)),
    statement: mapStatement(rawStatement),
  };
}

export async function markFinanceStatementPaid(
  id: string,
  paidAt?: string | null,
): Promise<Statement> {
  const payload = await request<Record<string, unknown>>(`/finance_statements/${id}/mark-paid/`, {
    method: 'POST',
    body: JSON.stringify({ paid_at: paidAt }),
  });
  return mapStatement(payload);
}

export async function reopenFinanceStatement(id: string): Promise<Statement> {
  const payload = await request<Record<string, unknown>>(`/finance_statements/${id}/reopen/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return mapStatement(payload);
}
