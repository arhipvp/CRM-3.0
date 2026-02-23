import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapActivityLog, mapDeal, mapQuote } from './mappers';
import type {
  ActivityLog,
  Deal,
  DealMergeResponse,
  DealMergePreviewResponse,
  DealSimilarityCandidate,
  DealSimilarityResponse,
  DealTimeTrackingSummary,
  DealTimeTrackingTickResponse,
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
  const payload = await request<Record<string, unknown>>(
    `/deals/${id}/?show_closed=1&show_deleted=1`,
  );
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
  finalDeal: {
    title: string;
    description?: string;
    clientId: string;
    expectedClose?: string | null;
    executorId?: string | null;
    sellerId?: string | null;
    source?: string | null;
    nextContactDate?: string | null;
    visibleUserIds?: string[];
  };
  includeDeleted?: boolean;
  previewSnapshotId?: string;
}): Promise<DealMergeResponse> {
  const payload = await request<Record<string, unknown>>('/deals/merge/', {
    method: 'POST',
    body: JSON.stringify({
      target_deal_id: data.targetDealId,
      source_deal_ids: data.sourceDealIds,
      final_deal: {
        title: data.finalDeal.title,
        description: data.finalDeal.description ?? '',
        client_id: data.finalDeal.clientId,
        expected_close: data.finalDeal.expectedClose || null,
        executor_id: data.finalDeal.executorId || null,
        seller_id: data.finalDeal.sellerId || null,
        source: data.finalDeal.source ?? '',
        next_contact_date: data.finalDeal.nextContactDate || null,
        visible_user_ids: data.finalDeal.visibleUserIds ?? [],
      },
      include_deleted: data.includeDeleted ?? true,
      ...(data.previewSnapshotId ? { preview_snapshot_id: data.previewSnapshotId } : {}),
    }),
  });

  const resultPayload = payload.result_deal as Record<string, unknown>;
  if (!resultPayload) {
    throw new Error('Ответ API не содержит данные итоговой сделки');
  }

  const mergedDealIds = Array.isArray(payload.merged_deal_ids)
    ? payload.merged_deal_ids.map((value) => String(value))
    : [];
  const movedCounts = (payload.moved_counts ?? {}) as Record<string, number>;

  return {
    resultDeal: mapDeal(resultPayload),
    mergedDealIds,
    movedCounts,
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((value) => String(value)) : [],
    details:
      payload.details && typeof payload.details === 'object'
        ? (payload.details as Record<string, unknown>)
        : {},
  };
}

export async function previewDealMerge(data: {
  targetDealId: string;
  sourceDealIds: string[];
  includeDeleted?: boolean;
}): Promise<DealMergePreviewResponse> {
  const payload = await request<Record<string, unknown>>('/deals/merge/preview/', {
    method: 'POST',
    body: JSON.stringify({
      target_deal_id: data.targetDealId,
      source_deal_ids: data.sourceDealIds,
      include_deleted: data.includeDeleted ?? true,
    }),
  });

  return {
    targetDealId: String(payload.target_deal_id ?? ''),
    sourceDealIds: Array.isArray(payload.source_deal_ids)
      ? payload.source_deal_ids.map((value) => String(value))
      : [],
    includeDeleted: Boolean(payload.include_deleted ?? true),
    movedCounts:
      payload.moved_counts && typeof payload.moved_counts === 'object'
        ? (payload.moved_counts as Record<string, number>)
        : {},
    items:
      payload.items && typeof payload.items === 'object'
        ? (payload.items as Record<string, Array<Record<string, unknown>>>)
        : {},
    drivePlan: Array.isArray(payload.drive_plan)
      ? payload.drive_plan.map((value) => value as Record<string, unknown>)
      : [],
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((value) => String(value)) : [],
    finalDealDraft:
      payload.final_deal_draft && typeof payload.final_deal_draft === 'object'
        ? {
            title: String((payload.final_deal_draft as Record<string, unknown>).title ?? ''),
            description: String(
              (payload.final_deal_draft as Record<string, unknown>).description ?? '',
            ),
            clientId: String((payload.final_deal_draft as Record<string, unknown>).client_id ?? ''),
            expectedClose:
              (payload.final_deal_draft as Record<string, unknown>).expected_close == null
                ? null
                : String((payload.final_deal_draft as Record<string, unknown>).expected_close),
            executorId:
              (payload.final_deal_draft as Record<string, unknown>).executor_id == null
                ? null
                : String((payload.final_deal_draft as Record<string, unknown>).executor_id),
            sellerId:
              (payload.final_deal_draft as Record<string, unknown>).seller_id == null
                ? null
                : String((payload.final_deal_draft as Record<string, unknown>).seller_id),
            source: String((payload.final_deal_draft as Record<string, unknown>).source ?? ''),
            nextContactDate:
              (payload.final_deal_draft as Record<string, unknown>).next_contact_date == null
                ? null
                : String((payload.final_deal_draft as Record<string, unknown>).next_contact_date),
            visibleUserIds: Array.isArray(
              (payload.final_deal_draft as Record<string, unknown>).visible_user_ids,
            )
              ? (
                  (payload.final_deal_draft as Record<string, unknown>)
                    .visible_user_ids as unknown[]
                ).map((value) => String(value))
              : [],
          }
        : undefined,
  };
}

export async function findSimilarDeals(data: {
  targetDealId: string;
  limit?: number;
  includeSelf?: boolean;
  includeClosed?: boolean;
  includeDeleted?: boolean;
}): Promise<DealSimilarityResponse> {
  const payload = await request<Record<string, unknown>>('/deals/similar/', {
    method: 'POST',
    body: JSON.stringify({
      target_deal_id: data.targetDealId,
      limit: data.limit ?? 30,
      include_self: data.includeSelf ?? false,
      include_closed: data.includeClosed ?? false,
      include_deleted: data.includeDeleted ?? false,
    }),
  });

  const targetDealPayload =
    payload.target_deal && typeof payload.target_deal === 'object'
      ? (payload.target_deal as Record<string, unknown>)
      : null;
  if (!targetDealPayload) {
    throw new Error('Ответ API не содержит целевую сделку');
  }

  const candidatesRaw = Array.isArray(payload.candidates) ? payload.candidates : [];
  const candidates = candidatesRaw.map((value) => {
    const record = value as Record<string, unknown>;
    const dealPayload =
      record.deal && typeof record.deal === 'object'
        ? (record.deal as Record<string, unknown>)
        : null;
    if (!dealPayload) {
      throw new Error('Ответ API содержит кандидата без сделки');
    }
    const confidenceValue = String(record.confidence ?? 'low').toLowerCase();
    const confidence: DealSimilarityCandidate['confidence'] =
      confidenceValue === 'high' || confidenceValue === 'medium' || confidenceValue === 'low'
        ? confidenceValue
        : 'low';
    return {
      deal: mapDeal(dealPayload),
      score: Number(record.score ?? 0),
      confidence,
      reasons: Array.isArray(record.reasons) ? record.reasons.map((item) => String(item)) : [],
      matchedFields:
        record.matched_fields && typeof record.matched_fields === 'object'
          ? (record.matched_fields as Record<string, unknown>)
          : {},
      mergeBlockers: Array.isArray(record.merge_blockers)
        ? record.merge_blockers.map((item) => String(item))
        : [],
    };
  });

  const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : {};
  const metaRecord = meta as Record<string, unknown>;

  return {
    targetDeal: mapDeal(targetDealPayload),
    candidates,
    meta: {
      totalChecked: Number(metaRecord.total_checked ?? 0),
      returned: Number(metaRecord.returned ?? candidates.length),
      scoringVersion: String(metaRecord.scoring_version ?? 'deal-sim-v1'),
    },
  };
}

export async function createDealMailbox(dealId: string): Promise<DealMailboxCreateResult> {
  const payload = await request<Record<string, unknown>>(`/deals/${dealId}/mailbox/create/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });

  const mailboxInitialPassword =
    typeof payload.mailbox_initial_password === 'string' // pragma: allowlist secret
      ? payload.mailbox_initial_password
      : null;

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
    const rawDoc =
      item.doc && typeof item.doc === 'object' ? (item.doc as Record<string, unknown>) : null;
    const rawValidation =
      rawDoc?.validation && typeof rawDoc.validation === 'object'
        ? (rawDoc.validation as Record<string, unknown>)
        : {};
    const rawType = String(rawDoc?.rawType ?? '').trim();
    const normalizedType =
      normalizeDocumentType(rawDoc?.normalizedType) ?? normalizeDocumentType(rawType);
    const warningsRaw = Array.isArray(rawDoc?.warnings) ? rawDoc?.warnings : [];
    const fields =
      rawDoc?.fields && typeof rawDoc.fields === 'object'
        ? (rawDoc.fields as Record<string, unknown>)
        : {};
    const acceptedRaw = Array.isArray(rawValidation.accepted) ? rawValidation.accepted : [];
    const rejectedRaw =
      rawValidation.rejected && typeof rawValidation.rejected === 'object'
        ? (rawValidation.rejected as Record<string, unknown>)
        : {};
    const confidenceRaw = rawDoc?.confidence;
    const confidence =
      confidenceRaw === null || confidenceRaw === undefined || Number.isNaN(Number(confidenceRaw))
        ? null
        : Number(confidenceRaw);
    const rawError =
      item.error && typeof item.error === 'object' ? (item.error as Record<string, unknown>) : null;
    return {
      fileId: String(item.fileId ?? item.file_id ?? ''),
      fileName: item.fileName === undefined ? null : String(item.fileName ?? item.file_name ?? ''),
      status,
      transcript:
        item.transcript === undefined
          ? null
          : String(item.transcript ?? item.transcript_text ?? ''),
      doc: rawDoc
        ? {
            rawType: rawType || 'unknown',
            normalizedType,
            confidence,
            warnings: warningsRaw.map((warning) => String(warning)).filter(Boolean),
            fields,
            validation: {
              accepted: acceptedRaw.map((field) => String(field)).filter(Boolean),
              rejected: Object.fromEntries(
                Object.entries(rejectedRaw).map(([key, value]) => [key, String(value)]),
              ),
            },
            extractedText: String(rawDoc.extractedText ?? ''),
          }
        : null,
      error: rawError
        ? {
            code: String(rawError.code ?? 'recognition_error'),
            message: String(rawError.message ?? 'Ошибка распознавания документа.'),
          }
        : null,
    };
  });
  return {
    results,
    noteId: payload.noteId === undefined || payload.noteId === null ? null : String(payload.noteId),
  };
}

export async function fetchDealTimeTrackingSummary(
  dealId: string,
): Promise<DealTimeTrackingSummary> {
  const payload = await request<Record<string, unknown>>(`/deals/${dealId}/time-track/summary/`);
  return {
    enabled: Boolean(payload.enabled ?? true),
    tickSeconds: Number(payload.tick_seconds ?? payload.tickSeconds ?? 10),
    confirmIntervalSeconds: Number(
      payload.confirm_interval_seconds ?? payload.confirmIntervalSeconds ?? 600,
    ),
    myTotalSeconds: Number(payload.my_total_seconds ?? payload.myTotalSeconds ?? 0),
    myTotalHuman: String(payload.my_total_human ?? payload.myTotalHuman ?? '00:00:00'),
  };
}

export async function sendDealTimeTrackingTick(
  dealId: string,
): Promise<DealTimeTrackingTickResponse> {
  const payload = await request<Record<string, unknown>>(`/deals/${dealId}/time-track/tick/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return {
    enabled: Boolean(payload.enabled ?? true),
    tickSeconds: Number(payload.tick_seconds ?? payload.tickSeconds ?? 10),
    confirmIntervalSeconds: Number(
      payload.confirm_interval_seconds ?? payload.confirmIntervalSeconds ?? 600,
    ),
    counted: Boolean(payload.counted ?? false),
    bucketStart:
      payload.bucket_start === undefined && payload.bucketStart === undefined
        ? null
        : String(payload.bucket_start ?? payload.bucketStart ?? ''),
    myTotalSeconds: Number(payload.my_total_seconds ?? payload.myTotalSeconds ?? 0),
    reason: payload.reason === undefined ? undefined : String(payload.reason),
  };
}
