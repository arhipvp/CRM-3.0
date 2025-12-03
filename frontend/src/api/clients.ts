import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapClient, mapUser } from './mappers';
import type { Client, ClientMergeResponse, User } from '../types';

export async function fetchClientsWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Client>> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/clients/${qs}`);
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
  let nextPage = page ?? 1;
  const clients: Client[] = [];

  while (true) {
    const payload = await fetchClientsWithPagination({
      ...restFilters,
      page: nextPage,
      page_size: pageSize,
    });

    if (!payload.results.length) {
      break;
    }

    clients.push(...payload.results);

    if (!payload.next) {
      break;
    }

    nextPage += 1;
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
  data: { name: string; phone?: string; birthDate?: string | null; notes?: string | null; email?: string | null }
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
}): Promise<ClientMergeResponse> {
  const payload = await request<Record<string, unknown>>('/clients/merge/', {
    method: 'POST',
    body: JSON.stringify({
      target_client_id: data.targetClientId,
      source_client_ids: data.sourceClientIds,
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
  };
}
