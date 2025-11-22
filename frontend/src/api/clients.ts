import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapClient, mapUser } from './mappers';
import type { Client, User } from '../types';

export async function fetchClients(filters?: FilterParams): Promise<Client[]> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/clients/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapClient);
}

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
}): Promise<Client> {
  const payload = await request<Record<string, unknown>>('/clients/', {
    method: 'POST',
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate || null,
      notes: data.notes ?? '',
    }),
  });
  return mapClient(payload);
}

export async function updateClient(
  id: string,
  data: { name: string; phone?: string; birthDate?: string | null; notes?: string | null }
): Promise<Client> {
  const payload = await request<Record<string, unknown>>(`/clients/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: data.name,
      phone: data.phone,
      birth_date: data.birthDate || null,
      notes: data.notes ?? '',
    }),
  });
  return mapClient(payload);
}
