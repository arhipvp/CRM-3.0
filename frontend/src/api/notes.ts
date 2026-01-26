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

export async function createNote(
  dealId: string,
  body: string,
  attachments?: Note['attachments'],
  isImportant?: boolean,
): Promise<Note> {
  const payloadBody: Record<string, unknown> = {
    deal: dealId,
    body,
    is_important: Boolean(isImportant),
  };
  if (attachments && attachments.length > 0) {
    payloadBody.attachments = attachments.map((file) => ({
      id: file.id,
      name: file.name,
      mime_type: file.mimeType,
      size: file.size,
      web_view_link: file.webViewLink,
    }));
  }
  const payload = await request<Record<string, unknown>>('/notes/', {
    method: 'POST',
    body: JSON.stringify(payloadBody),
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
