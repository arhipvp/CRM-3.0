import { API_BASE, request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapClient, mapUser } from './mappers';
import type {
  Client,
  ClientDuplicateHint,
  ClientMergePreviewResponse,
  ClientMergeResponse,
  ClientMergeSessionStatus,
  ClientSimilarityExclusion,
  ClientSimilarResponse,
  User,
} from '../types';

export async function fetchClientsWithPagination(
  filters?: FilterParams,
): Promise<PaginatedResponse<Client>> {
  const qs = buildQueryString(filters);
  return fetchClientsPage(`/clients/${qs}`);
}

const API_BASE_PATH = (() => {
  try {
    const parsed = new URL(API_BASE, 'http://localhost');
    const normalized = parsed.pathname.replace(/\/$/, '');
    return normalized === '/' ? '' : normalized;
  } catch {
    const trimmed = API_BASE.replace(/\/$/, '');
    return trimmed === '/' ? '' : trimmed;
  }
})();

const ensureLeadingSlash = (value: string): string => (value.startsWith('/') ? value : `/${value}`);

function normalizeClientRequestPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) {
    return '/clients/';
  }
  try {
    const parsed = new URL(trimmed, 'http://localhost');
    const candidate = `${parsed.pathname}${parsed.search}`;
    if (API_BASE_PATH && candidate.startsWith(API_BASE_PATH)) {
      const stripped = candidate.slice(API_BASE_PATH.length) || '/';
      return ensureLeadingSlash(stripped);
    }
    return ensureLeadingSlash(candidate);
  } catch {
    return ensureLeadingSlash(trimmed);
  }
}

async function fetchClientsPage(path: string): Promise<PaginatedResponse<Client>> {
  const normalizedPath = normalizeClientRequestPath(path);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(normalizedPath);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList<Record<string, unknown>>(payload).map(mapClient),
  };
}

const DEFAULT_CLIENTS_PAGE_SIZE = 100;

export async function fetchClients(filters?: FilterParams): Promise<Client[]> {
  const baseFilters = { ...(filters ?? {}) };
  const { page, page_size, ...restFilters } = baseFilters;
  const pageSize = page_size ?? DEFAULT_CLIENTS_PAGE_SIZE;
  const clients: Client[] = [];
  const initialFilters: FilterParams = {
    ...restFilters,
    ...(page !== undefined ? { page } : {}),
    page_size: pageSize,
  };
  let nextPath: string | null = `/clients/${buildQueryString(initialFilters)}`;

  while (true) {
    if (!nextPath) {
      break;
    }
    const payload = await fetchClientsPage(nextPath);

    if (!payload.results.length) {
      break;
    }

    clients.push(...payload.results);

    nextPath = payload.next ? normalizeClientRequestPath(payload.next) : null;
  }

  return clients;
}

export async function fetchUsers(filters?: FilterParams): Promise<User[]> {
  const qs = buildQueryString(filters);
  const payload = await request(`/users/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapUser);
}

export async function createClient(data: {
  name: string;
  isCounterparty?: boolean;
  phone?: string;
  birthDate?: string | null;
  notes?: string | null;
  email?: string | null;
}): Promise<Client> {
  const payload = await request<Record<string, unknown>>('/clients/', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      is_counterparty: Boolean(data.isCounterparty),
      phone: data.phone,
      birth_date: data.birthDate || null,
      email: data.email?.trim() || null,
      notes: data.notes ?? '',
    }),
  });
  return mapClient(payload);
}

export async function updateClient(
  id: string,
  data: {
    name: string;
    isCounterparty?: boolean;
    phone?: string;
    birthDate?: string | null;
    notes?: string | null;
    email?: string | null;
  },
): Promise<Client> {
  const payload = await request<Record<string, unknown>>(`/clients/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: data.name,
      is_counterparty: Boolean(data.isCounterparty),
      phone: data.phone,
      birth_date: data.birthDate || null,
      email: data.email?.trim() || null,
      notes: data.notes ?? '',
    }),
  });
  return mapClient(payload);
}

export async function deleteClient(id: string): Promise<void> {
  await request(`/clients/${id}/`, {
    method: 'DELETE',
  });
}

function mapDuplicateHint(raw: Record<string, unknown>): ClientDuplicateHint {
  const confidenceRaw = raw.confidence;
  const confidence: ClientDuplicateHint['confidence'] =
    confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
      ? confidenceRaw
      : 'low';
  return {
    clientId: String(raw.client_id ?? raw.clientId ?? ''),
    candidateCount: Number(raw.candidate_count ?? raw.candidateCount ?? 0),
    maxScore: Number(raw.max_score ?? raw.maxScore ?? 0),
    confidence,
    reasons: Array.isArray(raw.reasons) ? raw.reasons.map((value) => String(value)) : [],
    needsNameNormalization: Boolean(
      raw.needs_name_normalization ?? raw.needsNameNormalization ?? false,
    ),
    normalizedName: String(raw.normalized_name ?? raw.normalizedName ?? ''),
  };
}

export async function fetchClientDuplicateHints(
  clientIds: string[],
): Promise<Record<string, ClientDuplicateHint>> {
  if (!clientIds.length) {
    return {};
  }
  const payload = await request<Record<string, unknown>>('/clients/duplicate-hints/', {
    method: 'POST',
    body: JSON.stringify({
      client_ids: clientIds,
    }),
  });
  const resultsRaw =
    payload.results && typeof payload.results === 'object'
      ? (payload.results as Record<string, unknown>)
      : {};
  return Object.fromEntries(
    Object.entries(resultsRaw)
      .map(([clientId, value]) => {
        if (!value || typeof value !== 'object') {
          return null;
        }
        const hint = mapDuplicateHint(value as Record<string, unknown>);
        return [clientId, hint] as const;
      })
      .filter((entry): entry is readonly [string, ClientDuplicateHint] => entry !== null),
  );
}

export async function normalizeClientName(id: string): Promise<Client> {
  const payload = await request<Record<string, unknown>>(`/clients/${id}/normalize-name/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return mapClient(payload);
}

export async function mergeClients(data: {
  targetClientId: string;
  sourceClientIds: string[];
  includeDeleted?: boolean;
  previewSnapshotId?: string;
  fieldOverrides?: {
    name?: string;
    phone?: string;
    email?: string | null;
    notes?: string;
  };
}): Promise<ClientMergeResponse> {
  const payload = await request<Record<string, unknown>>('/clients/merge/', {
    method: 'POST',
    body: JSON.stringify({
      target_client_id: data.targetClientId,
      source_client_ids: data.sourceClientIds,
      include_deleted: data.includeDeleted ?? true,
      ...(data.previewSnapshotId ? { preview_snapshot_id: data.previewSnapshotId } : {}),
      ...(data.fieldOverrides ? { field_overrides: data.fieldOverrides } : {}),
    }),
  });

  return mapClientMergeResponse(payload);
}

type ClientMergePayload = {
  targetClientId: string;
  sourceClientIds: string[];
  includeDeleted?: boolean;
  previewSnapshotId?: string;
  fieldOverrides?: {
    name?: string;
    phone?: string;
    email?: string | null;
    notes?: string;
  };
};

function mapClientMergeResponse(payload: Record<string, unknown>): ClientMergeResponse {
  const targetRaw = payload.target_client as Record<string, unknown> | undefined;
  const movedCountsRaw = payload.moved_counts as Record<string, number> | undefined;

  if (!targetRaw) {
    throw new Error('Client merge response is missing the target client');
  }

  return {
    targetClient: mapClient(targetRaw),
    mergedClientIds: Array.isArray(payload.merged_client_ids)
      ? payload.merged_client_ids.map((value) => String(value))
      : [],
    movedCounts: movedCountsRaw ?? {},
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((value) => String(value)) : [],
    details:
      payload.details && typeof payload.details === 'object'
        ? (payload.details as Record<string, unknown>)
        : {},
  };
}

function mapClientMergeSession(payload: Record<string, unknown>): ClientMergeSessionStatus {
  const failedItem =
    payload.failed_item && typeof payload.failed_item === 'object'
      ? (payload.failed_item as Record<string, unknown>)
      : null;
  const result =
    payload.result && typeof payload.result === 'object'
      ? (payload.result as Record<string, unknown>)
      : null;

  return {
    id: String(payload.id ?? ''),
    status: String(payload.status ?? 'failed') as ClientMergeSessionStatus['status'],
    targetClientId: String(payload.target_client_id ?? ''),
    sourceClientIds: Array.isArray(payload.source_client_ids)
      ? payload.source_client_ids.map((value) => String(value))
      : [],
    movedItems: Number(payload.moved_items ?? 0),
    totalItems: Number(payload.total_items ?? 0),
    retryable: Boolean(payload.retryable),
    failedItem,
    lastError: String(payload.last_error ?? ''),
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((value) => String(value)) : [],
    result,
    createdAt: payload.created_at ? String(payload.created_at) : null,
    updatedAt: payload.updated_at ? String(payload.updated_at) : null,
  };
}

function serializeClientMergePayload(data: ClientMergePayload): Record<string, unknown> {
  return {
    target_client_id: data.targetClientId,
    source_client_ids: data.sourceClientIds,
    include_deleted: data.includeDeleted ?? true,
    ...(data.previewSnapshotId ? { preview_snapshot_id: data.previewSnapshotId } : {}),
    ...(data.fieldOverrides ? { field_overrides: data.fieldOverrides } : {}),
  };
}

export async function startClientMerge(
  data: ClientMergePayload,
): Promise<ClientMergeSessionStatus> {
  const payload = await request<Record<string, unknown>>('/clients/merge/start/', {
    method: 'POST',
    body: JSON.stringify(serializeClientMergePayload(data)),
  });
  return mapClientMergeSession(payload);
}

export async function fetchClientMergeSession(
  sessionId: string,
): Promise<ClientMergeSessionStatus> {
  const payload = await request<Record<string, unknown>>(`/clients/merge/${sessionId}/`, {
    method: 'GET',
  });
  return mapClientMergeSession(payload);
}

export async function stepClientMerge(sessionId: string): Promise<ClientMergeSessionStatus> {
  const payload = await request<Record<string, unknown>>(`/clients/merge/${sessionId}/step/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return mapClientMergeSession(payload);
}

export async function retryClientMerge(sessionId: string): Promise<ClientMergeSessionStatus> {
  const payload = await request<Record<string, unknown>>(`/clients/merge/${sessionId}/retry/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return mapClientMergeSession(payload);
}

export async function finalizeClientMerge(sessionId: string): Promise<ClientMergeResponse> {
  const payload = await request<Record<string, unknown>>(`/clients/merge/${sessionId}/finalize/`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  return mapClientMergeResponse(payload);
}

export async function previewClientMerge(data: {
  targetClientId: string;
  sourceClientIds: string[];
  includeDeleted?: boolean;
}): Promise<ClientMergePreviewResponse> {
  const payload = await request<Record<string, unknown>>('/clients/merge/preview/', {
    method: 'POST',
    body: JSON.stringify({
      target_client_id: data.targetClientId,
      source_client_ids: data.sourceClientIds,
      include_deleted: data.includeDeleted ?? true,
    }),
  });

  const canonicalRaw =
    payload.canonical_profile && typeof payload.canonical_profile === 'object'
      ? (payload.canonical_profile as Record<string, unknown>)
      : {};
  const candidatesRaw =
    canonicalRaw.candidates && typeof canonicalRaw.candidates === 'object'
      ? (canonicalRaw.candidates as Record<string, unknown>)
      : {};

  const toStringList = (value: unknown): string[] =>
    Array.isArray(value) ? value.map((item) => String(item)) : [];

  return {
    targetClientId: String(payload.target_client_id ?? ''),
    sourceClientIds: Array.isArray(payload.source_client_ids)
      ? payload.source_client_ids.map((value) => String(value))
      : [],
    includeDeleted: Boolean(payload.include_deleted ?? true),
    previewSnapshotId: String(payload.preview_snapshot_id ?? ''),
    movedCounts:
      payload.moved_counts && typeof payload.moved_counts === 'object'
        ? (payload.moved_counts as Record<string, number>)
        : {},
    items:
      payload.items && typeof payload.items === 'object'
        ? (payload.items as Record<string, Array<Record<string, unknown>>>)
        : {},
    canonicalProfile: {
      name: String(canonicalRaw.name ?? ''),
      phone: String(canonicalRaw.phone ?? ''),
      email: canonicalRaw.email == null ? null : String(canonicalRaw.email),
      notes: String(canonicalRaw.notes ?? ''),
      candidates: {
        names: toStringList(candidatesRaw.names),
        phones: toStringList(candidatesRaw.phones),
        emails: toStringList(candidatesRaw.emails),
      },
    },
    drivePlan: Array.isArray(payload.drive_plan)
      ? payload.drive_plan.map((value) => value as Record<string, unknown>)
      : [],
    warnings: Array.isArray(payload.warnings) ? payload.warnings.map((value) => String(value)) : [],
  };
}

export async function fetchSimilarClients(data: {
  targetClientId: string;
  limit?: number;
  includeSelf?: boolean;
}): Promise<ClientSimilarResponse> {
  const payload = await request<Record<string, unknown>>('/clients/similar/', {
    method: 'POST',
    body: JSON.stringify({
      target_client_id: data.targetClientId,
      limit: data.limit ?? 50,
      include_self: data.includeSelf ?? false,
    }),
  });

  const targetRaw = payload.target_client as Record<string, unknown> | undefined;
  if (!targetRaw) {
    throw new Error('Similar clients response is missing target client');
  }

  const candidatesRaw = Array.isArray(payload.candidates)
    ? (payload.candidates as Array<Record<string, unknown>>)
    : [];
  const metaRaw =
    payload.meta && typeof payload.meta === 'object'
      ? (payload.meta as Record<string, unknown>)
      : {};

  return {
    targetClient: mapClient(targetRaw),
    candidates: candidatesRaw
      .map((candidate) => {
        const clientRaw = candidate.client as Record<string, unknown> | undefined;
        if (!clientRaw) {
          return null;
        }
        const confidenceRaw = candidate.confidence;
        const confidence: 'high' | 'medium' | 'low' =
          confidenceRaw === 'high' || confidenceRaw === 'medium' || confidenceRaw === 'low'
            ? confidenceRaw
            : 'low';
        return {
          client: mapClient(clientRaw),
          score: Number(candidate.score ?? 0),
          confidence,
          reasons: Array.isArray(candidate.reasons)
            ? candidate.reasons.map((value) => String(value))
            : [],
          matchedFields:
            candidate.matched_fields && typeof candidate.matched_fields === 'object'
              ? (candidate.matched_fields as Record<string, boolean>)
              : {},
          relationCounts:
            candidate.relation_counts && typeof candidate.relation_counts === 'object'
              ? {
                  deals: Number((candidate.relation_counts as Record<string, unknown>).deals ?? 0),
                  policies: Number(
                    (candidate.relation_counts as Record<string, unknown>).policies ?? 0,
                  ),
                  insuredPolicies: Number(
                    (candidate.relation_counts as Record<string, unknown>).insured_policies ?? 0,
                  ),
                }
              : undefined,
        };
      })
      .filter((candidate): candidate is NonNullable<typeof candidate> => candidate !== null),
    meta: {
      totalChecked: Number(metaRaw.total_checked ?? 0),
      returned: Number(metaRaw.returned ?? 0),
      scoringVersion: String(metaRaw.scoring_version ?? 'v1'),
    },
  };
}

export async function excludeClientSimilarity(data: {
  targetClientId: string;
  candidateClientId: string;
}): Promise<ClientSimilarityExclusion> {
  const payload = await request<Record<string, unknown>>('/clients/similarity-exclusions/', {
    method: 'POST',
    body: JSON.stringify({
      target_client_id: data.targetClientId,
      candidate_client_id: data.candidateClientId,
    }),
  });

  return {
    id: String(payload.id ?? ''),
    firstClientId: String(payload.first_client_id ?? payload.firstClientId ?? ''),
    secondClientId: String(payload.second_client_id ?? payload.secondClientId ?? ''),
    createdAt: String(payload.created_at ?? payload.createdAt ?? ''),
  };
}
