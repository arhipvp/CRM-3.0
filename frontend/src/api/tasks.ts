import { request } from './request';
import { buildQueryString, FilterParams, PaginatedResponse, unwrapList } from './helpers';
import { mapTask } from './mappers';
import type { Task } from '../types';

export async function fetchTasks(filters?: FilterParams): Promise<Task[]> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/tasks/${qs}`);
  return unwrapList<Record<string, unknown>>(payload).map(mapTask);
}

export async function fetchTasksWithPagination(
  filters?: FilterParams
): Promise<PaginatedResponse<Task>> {
  const qs = buildQueryString(filters);
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/tasks/${qs}`);
  return {
    count: payload.count || 0,
    next: payload.next || null,
    previous: payload.previous || null,
    results: unwrapList<Record<string, unknown>>(payload).map(mapTask),
  };
}

export async function createTask(data: {
  dealId: string;
  title: string;
  description?: string;
  priority: string;
  dueAt?: string | null;
  status?: string;
  assigneeId?: string | null;
}): Promise<Task> {
  const body: Record<string, unknown> = {
    deal: data.dealId,
    title: data.title,
    description: data.description || '',
    priority: data.priority,
    due_at: data.dueAt || null,
    status: data.status || 'todo',
  };
  if (data.assigneeId) {
    body.assignee = data.assigneeId;
  }

  const payload = await request<Record<string, unknown>>('/tasks/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return mapTask(payload);
}

export async function updateTask(
  id: string,
  data: Partial<{
    title: string;
    description: string;
    priority: string;
    dueAt: string | null;
    status: string;
    assigneeId?: string | null;
  }>
): Promise<Task> {
  const body: Record<string, unknown> = {
    title: data.title,
    description: data.description,
    priority: data.priority,
    due_at: data.dueAt,
    status: data.status,
  };
  if ('assigneeId' in data) {
    body.assignee = data.assigneeId === '' ? null : data.assigneeId;
  }

  const payload = await request<Record<string, unknown>>(`/tasks/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  return mapTask(payload);
}

export async function deleteTask(id: string): Promise<void> {
  await request(`/tasks/${id}/`, { method: 'DELETE' });
}
