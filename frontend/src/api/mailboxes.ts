import { request } from './request';

export interface Mailbox {
  id: number;
  email: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  initial_password?: string;
}

export interface MailboxMessage {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

export async function fetchMailboxes(): Promise<Mailbox[]> {
  return request<Mailbox[]>('/mailboxes/');
}

export async function createMailbox(payload: {
  local_part: string;
  display_name?: string;
}): Promise<Mailbox> {
  return request<Mailbox>('/mailboxes/', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function deleteMailbox(id: number): Promise<void> {
  await request<void>(`/mailboxes/${id}/`, {
    method: 'DELETE',
  });
}

export async function fetchMailboxMessages(
  id: number,
  limit = 20,
): Promise<{ items: MailboxMessage[] }> {
  return request<{ items: MailboxMessage[] }>(`/mailboxes/${id}/messages/?limit=${limit}`);
}
