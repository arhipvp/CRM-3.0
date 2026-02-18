import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapActivityLog, mapDeal, mapQuote } from './mappers';
import type {
  ActivityLog,
  Deal,
  DealMergeResponse,
  DocumentRecognitionResult,
  Quote,
} from '../types';

export interface DealMailboxCreateResult {
  deal: Deal;
  mailboxInitialPassword?: string | null;
}

export interface DealMailboxSyncResult {
  deal: Deal;
  mailboxSync: {
    processed: number;
    skipped: number;
    failed: number;
    deleted: number;
  };
}

export async function fetchDeals(filters?: FilterParams): Promise<Deal[]> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/deals/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapDeal);
}

export async function fetchDealsWithPagination(
  filters?: FilterParams,
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
  visibleUserIds?: string[];
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
      visible_users: data.visibleUserIds ?? [],
    }),
  });
  return mapDeal(payload);
}

type DealCloseInput = {
  reason: string;
  status?: 'won' | 'lost';
};

export async function closeDeal(id: string, data: DealCloseInput): Promise<Deal> {
  const payload = await request<Record<string, unknown>>(`/deals/${id}/close/`, {
    method: 'POST',
    body: JSON.stringify({
      reason: data.reason,
      status: data.status ?? 'won',
    }),
  });
  return mapDeal(payload);
}

export async function reopenDeal(id: string): Promise<Deal> {
  const payload = await request<Record<string, unknown>>(`/deals/${id}/reopen/`, {
    method: 'POST',
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
    visibleUserIds?: string[];
  },
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
  if (data.source !== undefined) {
    body.source = typeof data.source === 'string' ? data.source.trim() : '';
  }
  if ('visibleUserIds' in data) {
    body.visible_users = data.visibleUserIds ?? [];
  }

  const payload = await request<Record<string, unknown>>(`/deals/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapDeal(payload);
}

export async function pinDeal(id: string): Promise<Deal> {
  const payload = await request<Record<string, unknown>>(`/deals/${id}/pin/`, {
    method: 'POST',
  });
  return mapDeal(payload);
}

export async function unpinDeal(id: string): Promise<Deal> {
  const payload = await request<Record<string, unknown>>(`/deals/${id}/unpin/`, {
    method: 'POST',
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

export async function fetchDealHistory(
  dealId: string,
  includeDeleted = false,
): Promise<ActivityLog[]> {
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
  officialDealer: boolean;
  gap: boolean;
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
      official_dealer: data.officialDealer,
      gap: data.gap,
      comments: data.comments,
    }),
  });
  return mapQuote(payload);
}

export async function fetchDeal(id: string): Promise<Deal> {
  const payload = await request<Record<string, unknown>>(`/deals/${id}/`);
  return mapDeal(payload);
}

export async function updateQuote(
  id: string,
  data: {
    insuranceCompanyId: string;
    insuranceTypeId: string;
    sumInsured: number;
    premium: number;
    deductible?: string;
    officialDealer: boolean;
    gap: boolean;
    comments?: string;
  },
): Promise<Quote> {
  const payload = await request<Record<string, unknown>>(`/quotes/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      insurance_company: data.insuranceCompanyId,
      insurance_type: data.insuranceTypeId,
      sum_insured: data.sumInsured,
      premium: data.premium,
      deductible: data.deductible,
      official_dealer: data.officialDealer,
      gap: data.gap,
      comments: data.comments,
    }),
  });
  return mapQuote(payload);
}

export async function fetchQuotesWithPagination(
  filters?: FilterParams,
): Promise<PaginatedResponse<Quote>> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/quotes/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList<Record<string, unknown>>(payload).map(mapQuote),
  };
}

export async function fetchQuotesByDeal(
  dealId: string,
  options?: { showDeleted?: boolean; pageSize?: number },
): Promise<Quote[]> {
  const pageSize = options?.pageSize ?? 200;
  const showDeleted = options?.showDeleted ?? false;
  const results: Quote[] = [];
  let page = 1;

  while (true) {
    const payload = await fetchQuotesWithPagination({
      deal: dealId,
      show_deleted: showDeleted,
      page,
      page_size: pageSize,
    });
    results.push(...payload.results);
    if (!payload.next) {
      break;
    }
    page += 1;
  }

  return results;
}

export async function deleteQuote(id: string): Promise<void> {
  await request(`/quotes/${id}/`, { method: 'DELETE' });
}

export async function mergeDeals(data: {
  targetDealId: string;
  sourceDealIds: string[];
  resultingClientId?: string;
}): Promise<DealMergeResponse> {
  const payload = await request<Record<string, unknown>>('/deals/merge/', {
    method: 'POST',
    body: JSON.stringify({
      target_deal_id: data.targetDealId,
      source_deal_ids: data.sourceDealIds,
      ...(data.resultingClientId ? { resulting_client_id: data.resultingClientId } : {}),
    }),
  });

  const targetPayload = payload.target_deal as Record<string, unknown>;
  if (!targetPayload) {
    throw new Error('Ответ API не содержит данные целевой сделки');
  }

  const mergedDealIds = Array.isArray(payload.merged_deal_ids)
    ? payload.merged_deal_ids.map((value) => String(value))
    : [];
  const movedCounts = (payload.moved_counts ?? {}) as Record<string, number>;

  return {
    targetDeal: mapDeal(targetPayload),
    mergedDealIds,
    movedCounts,
  };
}

export async function createDealMailbox(dealId: string): Promise<DealMailboxCreateResult> {
  const payload = await request<Record<string, unknown>>(`/deals/${dealId}/mailbox/create/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const mailboxInitialPassword =
    typeof payload.mailbox_initial_password === 'string' ? payload.mailbox_initial_password : null;

  return {
    deal: mapDeal(payload),
    mailboxInitialPassword,
  };
}

export async function checkDealMailbox(dealId: string): Promise<DealMailboxSyncResult> {
  const payload = await request<Record<string, unknown>>(`/deals/${dealId}/mailbox/check/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const rawSync =
    payload.mailbox_sync && typeof payload.mailbox_sync === 'object'
      ? (payload.mailbox_sync as Record<string, unknown>)
      : {};

  return {
    deal: mapDeal(payload),
    mailboxSync: {
      processed: Number(rawSync.processed ?? 0),
      skipped: Number(rawSync.skipped ?? 0),
      failed: Number(rawSync.failed ?? 0),
      deleted: Number(rawSync.deleted ?? 0),
    },
  };
}

export async function recognizeDealDocuments(
  dealId: string,
  fileIds: string[],
): Promise<{ results: DocumentRecognitionResult[]; noteId: string | null }> {
  const payload = await request<{ results?: unknown[]; noteId?: unknown }>(
    `/deals/${dealId}/recognize-documents/`,
    {
      method: 'POST',
      body: JSON.stringify({ file_ids: fileIds }),
    },
  );
  const rawResults = Array.isArray(payload.results)
    ? (payload.results as Record<string, unknown>[])
    : [];
  const normalizeDocumentType = (
    value: unknown,
  ): 'passport' | 'driver_license' | 'epts' | 'sts' | null => {
    const raw = String(value ?? '')
      .trim()
      .toLowerCase();
    if (!raw || raw === 'unknown') {
      return null;
    }
    if (raw === 'passport' || raw === 'паспорт' || raw === 'паспорт рф') {
      return 'passport';
    }
    if (
      raw === 'driver_license' ||
      raw === 'driver licence' ||
      raw === 'driver license' ||
      raw === 'в/у' ||
      raw === 'водительское удостоверение'
    ) {
      return 'driver_license';
    }
    if (raw === 'epts' || raw === 'эптс' || raw === 'электронный птс') {
      return 'epts';
    }
    if (
      raw === 'sts' ||
      raw === 'стс' ||
      raw === 'свидетельство о регистрации тс' ||
      raw === 'свидетельство о регистрации транспортного средства'
    ) {
      return 'sts';
    }
    return null;
  };
  const results: DocumentRecognitionResult[] = rawResults.map((item) => {
    const status = String(item.status ?? 'error') === 'parsed' ? 'parsed' : 'error';
    const documentTypeRaw = String(item.documentType ?? item.document_type ?? '').trim();
    const normalizedType =
      normalizeDocumentType(item.normalizedType ?? item.normalized_type) ??
      normalizeDocumentType(documentTypeRaw);
    const warningsRaw = Array.isArray(item.warnings) ? item.warnings : [];
    const data = typeof item.data === 'object' && item.data !== null ? item.data : {};
    const confidenceRaw = item.confidence;
    const confidence =
      confidenceRaw === null || confidenceRaw === undefined || Number.isNaN(Number(confidenceRaw))
        ? null
        : Number(confidenceRaw);
    return {
      fileId: String(item.fileId ?? item.file_id ?? ''),
      fileName: item.fileName === undefined ? null : String(item.fileName ?? item.file_name ?? ''),
      status,
      documentType: documentTypeRaw || 'unknown',
      normalizedType,
      confidence,
      warnings: warningsRaw.map((warning) => String(warning)).filter(Boolean),
      message: item.message === undefined ? undefined : String(item.message ?? ''),
      transcript:
        item.transcript === undefined
          ? null
          : String(item.transcript ?? item.transcript_text ?? ''),
      data: data as Record<string, unknown>,
    };
  });
  return {
    results,
    noteId: payload.noteId === undefined || payload.noteId === null ? null : String(payload.noteId),
  };
}
