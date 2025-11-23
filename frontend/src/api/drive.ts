import { request } from './request';
import { PaginatedResponse, unwrapList } from './helpers';
import { mapDriveFile, mapKnowledgeDocument } from './mappers';
import type { DriveFile, KnowledgeDocument } from '../types';

export interface DriveFilesResponse {
  files: DriveFile[];
  folderId?: string | null;
}

function normalizeDriveResponse(payload: { files?: unknown[]; folder_id?: string | null } | undefined): DriveFilesResponse {
  const rawFiles = Array.isArray(payload?.files) ? (payload.files as Record<string, unknown>[]) : [];
  return {
    files: rawFiles.map(mapDriveFile),
    folderId: payload?.folder_id ?? null,
  };
}

export async function fetchDealDriveFiles(
  dealId: string,
  includeDeleted = false
): Promise<DriveFilesResponse> {
  const suffix = includeDeleted ? '?show_deleted=1' : '';
  const payload = await request<{ files?: unknown[]; folder_id?: string | null }>(
    `/deals/${dealId}/drive-files/${suffix}`
  );
  return normalizeDriveResponse(payload);
}

export async function fetchClientDriveFiles(clientId: string): Promise<DriveFilesResponse> {
  const payload = await request<{ files?: unknown[]; folder_id?: string | null }>(
    `/clients/${clientId}/drive-files/`
  );
  return normalizeDriveResponse(payload);
}

export async function fetchPolicyDriveFiles(policyId: string): Promise<DriveFilesResponse> {
  const payload = await request<{ files?: unknown[]; folder_id?: string | null }>(
    `/policies/${policyId}/drive-files/`
  );
  return normalizeDriveResponse(payload);
}

export async function fetchKnowledgeDocuments(): Promise<KnowledgeDocument[]> {
  const payload = await request<PaginatedResponse<Record<string, unknown>>>(`/knowledge_documents/`);
  return unwrapList<Record<string, unknown>>(payload).map(mapKnowledgeDocument);
}

export async function uploadKnowledgeDocument(
  file: File,
  metadata?: { title?: string; description?: string }
): Promise<KnowledgeDocument> {
  const formData = new FormData();
  formData.append('file', file);
  if (metadata?.title) {
    formData.append('title', metadata.title);
  }
  if (metadata?.description) {
    formData.append('description', metadata.description);
  }

  const payload = await request<Record<string, unknown>>('/knowledge_documents/', {
    method: 'POST',
    body: formData,
  });

  return mapKnowledgeDocument(payload);
}

export async function uploadDealDriveFile(
  dealId: string,
  file: File,
  includeDeleted = false
): Promise<DriveFile> {
  const formData = new FormData();
  formData.append('file', file);
  const suffix = includeDeleted ? '?show_deleted=1' : '';
  const payload = await request<{ file?: unknown; folder_id?: string | null }>(
    `/deals/${dealId}/drive-files/${suffix}`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!payload?.file) {
    throw new Error('Failed to attach file to Google Drive');
  }

  return mapDriveFile(payload.file as Record<string, unknown>);
}

export async function deleteDealDriveFile(dealId: string, fileId: string): Promise<void> {
  await request(`/deals/${dealId}/drive-files/delete/`, {
    method: 'POST',
    body: JSON.stringify({ file_id: fileId }),
  });
}

export async function uploadClientDriveFile(clientId: string, file: File): Promise<DriveFile> {
  const formData = new FormData();
  formData.append('file', file);

  const payload = await request<{ file?: unknown; folder_id?: string | null }>(
    `/clients/${clientId}/drive-files/`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!payload?.file) {
    throw new Error('Failed to attach file to Google Drive');
  }

  return mapDriveFile(payload.file as Record<string, unknown>);
}

export async function uploadPolicyDriveFile(policyId: string, file: File): Promise<DriveFile> {
  const formData = new FormData();
  formData.append('file', file);

  const payload = await request<{ file?: unknown; folder_id?: string | null }>(
    `/policies/${policyId}/drive-files/`,
    {
      method: 'POST',
      body: formData,
    }
  );

  if (!payload?.file) {
    throw new Error('Failed to attach file to Google Drive');
  }

  return mapDriveFile(payload.file as Record<string, unknown>);
}
