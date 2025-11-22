import { request } from './request';
import { buildQueryString, FilterParams, unwrapList } from './helpers';
import { mapNote } from './mappers';
import type { Note } from '../types';

export async function fetchDealNotes(dealId: string, archived?: boolean): Promise<Note[]> {
  const params: FilterParams = { deal: dealId };
  if (archived !== undefined) {
    params.archived = archived ? 'true' : 'false';
  }
  const qs = buildQueryString(params);
  const payload = await request(`/notes/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapNote);
}

export async function createNote(dealId: string, body: string): Promise<Note> {
  const payload = await request<Record<string, unknown>>('/notes/', {
    method: 'POST',
    body: JSON.stringify({
      deal: dealId,
      body,
    }),
  });
  return mapNote(payload);
}

export async function archiveNote(id: string): Promise<void> {
  await request(`/notes/${id}/`, { method: 'DELETE' });
}

export async function restoreNote(id: string): Promise<Note> {
  const payload = await request<Record<string, unknown>>(`/notes/${id}/restore/`, {
    method: 'POST',
  });
  return mapNote(payload);
}
