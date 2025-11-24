import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapClient, mapUser } from './mappers';
import type { Client, User } from '../types';

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
