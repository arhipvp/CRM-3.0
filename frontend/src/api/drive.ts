import { request } from './request';
import { mapDriveFile } from './mappers';
import type { DriveFile } from '../types';

export interface DriveFilesResponse {
  files: DriveFile[];
  folderId?: string | null;
}

export interface DriveTrashResponse {
  movedFileIds: string[];
  trashFolderId?: string | null;
}

function normalizeDriveResponse(
  payload: { files?: unknown[]; folder_id?: string | null } | undefined,
): DriveFilesResponse {
  const rawFiles = Array.isArray(payload?.files)
    ? (payload.files as Record<string, unknown>[])
    : [];
  return {
    files: rawFiles.map(mapDriveFile),
    folderId: payload?.folder_id ?? null,
  };
}

function normalizeTrashResponse(
  payload: { moved_file_ids?: unknown; trash_folder_id?: string | null } | undefined,
): DriveTrashResponse {
  const movedFileIds = Array.isArray(payload?.moved_file_ids)
    ? (payload?.moved_file_ids as unknown[]).filter(
        (value): value is string => typeof value === 'string',
      )
    : [];

  return {
    movedFileIds,
    trashFolderId: payload?.trash_folder_id ?? null,
  };
}

export async function fetchDealDriveFiles(
  dealId: string,
  includeDeleted = false,
): Promise<DriveFilesResponse> {
  const suffix = includeDeleted ? '?show_deleted=1' : '';
  const payload = await request<{ files?: unknown[]; folder_id?: string | null }>(
    `/deals/${dealId}/drive-files/${suffix}`,
  );
  return normalizeDriveResponse(payload);
}

export async function trashDealDriveFiles(
  dealId: string,
  fileIds: string[],
  includeDeleted = false,
): Promise<DriveTrashResponse> {
  const suffix = includeDeleted ? '?show_deleted=1' : '';
  const payload = await request<{ moved_file_ids?: unknown; trash_folder_id?: string | null }>(
    `/deals/${dealId}/drive-files/${suffix}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ file_ids: fileIds }),
    },
  );

  return normalizeTrashResponse(payload);
}

export async function renameDealDriveFile(
  dealId: string,
  fileId: string,
  name: string,
  includeDeleted = false,
): Promise<DriveFile> {
  const suffix = includeDeleted ? '?show_deleted=1' : '';
  const payload = await request<{ file?: unknown }>(`/deals/${dealId}/drive-files/${suffix}`, {
    method: 'PATCH',
    body: JSON.stringify({ file_id: fileId, name }),
  });

  if (!payload?.file) {
    throw new Error('Failed to rename Drive file');
  }

  return mapDriveFile(payload.file as Record<string, unknown>);
}

export async function fetchClientDriveFiles(clientId: string): Promise<DriveFilesResponse> {
  const payload = await request<{ files?: unknown[]; folder_id?: string | null }>(
    `/clients/${clientId}/drive-files/`,
  );
  return normalizeDriveResponse(payload);
}

export async function fetchPolicyDriveFiles(policyId: string): Promise<DriveFilesResponse> {
  const payload = await request<{ files?: unknown[]; folder_id?: string | null }>(
    `/policies/${policyId}/drive-files/`,
  );
  return normalizeDriveResponse(payload);
}

export async function fetchStatementDriveFiles(statementId: string): Promise<DriveFilesResponse> {
  const payload = await request<{ files?: unknown[]; folder_id?: string | null }>(
    `/finance_statements/${statementId}/drive-files/`,
  );
  return normalizeDriveResponse(payload);
}

export async function uploadDealDriveFile(
  dealId: string,
  file: File,
  includeDeleted = false,
): Promise<DriveFile> {
  const formData = new FormData();
  formData.append('file', file);
  const suffix = includeDeleted ? '?show_deleted=1' : '';
  const payload = await request<{ file?: unknown; folder_id?: string | null }>(
    `/deals/${dealId}/drive-files/${suffix}`,
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!payload?.file) {
    throw new Error('Failed to attach file to Google Drive');
  }

  return mapDriveFile(payload.file as Record<string, unknown>);
}

export async function uploadClientDriveFile(clientId: string, file: File): Promise<DriveFile> {
  const formData = new FormData();
  formData.append('file', file);

  const payload = await request<{ file?: unknown; folder_id?: string | null }>(
    `/clients/${clientId}/drive-files/`,
    {
      method: 'POST',
      body: formData,
    },
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
    },
  );

  if (!payload?.file) {
    throw new Error('Failed to attach file to Google Drive');
  }

  return mapDriveFile(payload.file as Record<string, unknown>);
}

export async function uploadStatementDriveFile(
  statementId: string,
  file: File,
): Promise<DriveFile> {
  const formData = new FormData();
  formData.append('file', file);

  const payload = await request<{ file?: unknown; folder_id?: string | null }>(
    `/finance_statements/${statementId}/drive-files/`,
    {
      method: 'POST',
      body: formData,
    },
  );

  if (!payload?.file) {
    throw new Error('Failed to attach file to Google Drive');
  }

  return mapDriveFile(payload.file as Record<string, unknown>);
}

export async function trashStatementDriveFiles(
  statementId: string,
  fileIds: string[],
): Promise<DriveTrashResponse> {
  const payload = await request<{ moved_file_ids?: unknown; trash_folder_id?: string | null }>(
    `/finance_statements/${statementId}/drive-files/`,
    {
      method: 'DELETE',
      body: JSON.stringify({ file_ids: fileIds }),
    },
  );

  return normalizeTrashResponse(payload);
}
