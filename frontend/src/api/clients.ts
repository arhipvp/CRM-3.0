import { API_BASE, request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapClient, mapUser } from './mappers';
import type { Client, ClientMergePreviewResponse, ClientMergeResponse, User } from '../types';

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
  phone?: string;
  birthDate?: string | null;
  notes?: string | null;
  email?: string | null;
}): Promise<Client> {
  const payload = await request<Record<string, unknown>>('/clients/', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
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
