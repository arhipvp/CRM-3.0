import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useDealDriveFiles } from '../hooks/useDealDriveFiles';
import type { Deal } from '../../../../types';

vi.mock('../../../../api', () => ({
  APIError: class APIError extends Error {},
  fetchDealDriveFiles: vi.fn(),
  uploadDealDriveFile: vi.fn(),
  downloadDealDriveFiles: vi.fn(),
  trashDealDriveFiles: vi.fn(),
  renameDealDriveFile: vi.fn(),
  recognizeDealPolicies: vi.fn(),
  recognizeDealDocuments: vi.fn(),
}));

import {
  downloadDealDriveFiles,
  fetchDealDriveFiles,
  recognizeDealDocuments,
  recognizeDealPolicies,
  trashDealDriveFiles,
} from '../../../../api';
const downloadDealDriveFilesMock = vi.mocked(downloadDealDriveFiles);
const fetchDealDriveFilesMock = vi.mocked(fetchDealDriveFiles);
const recognizeDealPoliciesMock = vi.mocked(recognizeDealPolicies);
const recognizeDealDocumentsMock = vi.mocked(recognizeDealDocuments);
const trashDealDriveFilesMock = vi.mocked(trashDealDriveFiles);

const createDeal = (overrides: Partial<Deal> = {}): Deal => ({
  id: 'deal-1',
  title: 'Deal 1',
  clientId: 'client-1',
  clientName: 'Client Name',
  status: 'open',
  createdAt: '2025-01-01T00:00:00Z',
  quotes: [],
  documents: [],
  driveFolderId: 'folder-old',
  deletedAt: null,
  ...overrides,
});

const renderDriveHook = (
  deal: Deal | null,
  options?: {
    onDriveFolderCreated?: (dealId: string, folderId: string) => void;
    onConfirmDeleteFile?: (fileName: string) => Promise<boolean>;
    onRefreshPolicies?: () => Promise<void>;
    onRefreshNotes?: () => Promise<void>;
    onPolicyDraftReady?: (
      dealId: string,
      parsed: Record<string, unknown>,
      fileName?: string | null,
      fileId?: string | null,
    ) => void;
  },
) => {
  const resultRef: { current: ReturnType<typeof useDealDriveFiles> | null } = {
    current: null,
  };

  const Wrapper: React.FC<{ deal: Deal | null }> = ({ deal }) => {
    const state = useDealDriveFiles({
      selectedDeal: deal,
      onDriveFolderCreated: options?.onDriveFolderCreated ?? (() => {}),
      onConfirmDeleteFile: options?.onConfirmDeleteFile,
      onRefreshPolicies: options?.onRefreshPolicies,
      onRefreshNotes: options?.onRefreshNotes,
      onPolicyDraftReady: options?.onPolicyDraftReady,
    });
    useEffect(() => {
      resultRef.current = state;
    }, [state]);
    return null;
  };

  const utils = render(<Wrapper deal={deal} />);
  return { ...utils, resultRef };
};

describe('useDealDriveFiles', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads files and reports new folders', async () => {
    const deal = createDeal();
    const file = {
      id: 'file-1',
      name: 'policy.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://drive.google.com/file',
      isFolder: false,
      parentId: null,
    };
    const folderId = 'folder-new';
    fetchDealDriveFilesMock.mockResolvedValueOnce({ files: [file], folderId });

    const onDriveFolderCreated = vi.fn();
    const { resultRef } = renderDriveHook(deal, { onDriveFolderCreated });

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });

    expect(fetchDealDriveFilesMock).toHaveBeenCalledWith(deal.id, false);
    expect(resultRef.current?.sortedDriveFiles).toEqual([file]);
    expect(onDriveFolderCreated).toHaveBeenCalledWith(deal.id, folderId);
  });

  it('loads folder children lazily and ignores folder selection', async () => {
    const deal = createDeal();
    const folder = {
      id: 'folder-1',
      name: 'Папка',
      mimeType: 'application/vnd.google-apps.folder',
      size: null,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://drive.google.com/folder',
      isFolder: true,
      parentId: null,
    };
    const nestedFile = {
      id: 'file-inside-1',
      name: 'nested.pdf',
      mimeType: 'application/pdf',
      size: 100,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://drive.google.com/file',
      isFolder: false,
      parentId: 'folder-1',
    };
    fetchDealDriveFilesMock
      .mockResolvedValueOnce({ files: [folder], folderId: 'folder-1' })
      .mockResolvedValueOnce({ files: [nestedFile], folderId: 'folder-1' });

    const { resultRef } = renderDriveHook(deal);

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });

    expect(resultRef.current?.sortedDriveFiles.map((item) => item.id)).toEqual(['folder-1']);

    act(() => {
      resultRef.current?.toggleDriveFileSelection(folder.id);
    });

    expect(resultRef.current?.selectedDriveFileIds).toEqual([]);

    await act(async () => {
      resultRef.current?.toggleFolderExpanded(folder.id);
    });

    await waitFor(() => {
      expect(fetchDealDriveFilesMock).toHaveBeenNthCalledWith(2, deal.id, false, folder.id);
    });

    expect(resultRef.current?.sortedDriveFiles.map((item) => item.id)).toEqual([
      'folder-1',
      'file-inside-1',
    ]);
  });

  it('shows a message when recognition is triggered without selection', async () => {
    const deal = createDeal();
    const { resultRef } = renderDriveHook(deal);

    await act(async () => {
      await resultRef.current?.handleRecognizePolicies();
    });

    await waitFor(() => {
      expect(resultRef.current?.recognitionMessage).toBe(
        'Выберите хотя бы один файл для распознавания.',
      );
    });
  });

  it('recognizes selected PDF files and notifies about parsed drafts', async () => {
    const deal = createDeal();
    const file = {
      id: 'file-1',
      name: 'policy.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://drive.google.com/file',
      isFolder: false,
      parentId: null,
    };
    const parsedResult = {
      fileId: file.id,
      status: 'parsed' as const,
      data: { foo: 'bar' },
      fileName: 'policy.pdf',
    };
    fetchDealDriveFilesMock.mockResolvedValue({ files: [file], folderId: null });
    recognizeDealPoliciesMock.mockResolvedValueOnce({ results: [parsedResult] });

    const onPolicyDraftReady = vi.fn();
    const { resultRef } = renderDriveHook(deal, { onPolicyDraftReady });

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });

    act(() => {
      resultRef.current?.toggleDriveFileSelection(file.id);
    });

    await act(async () => {
      await resultRef.current?.handleRecognizePolicies();
    });

    await waitFor(() => {
      expect(recognizeDealPoliciesMock).toHaveBeenCalledWith(deal.id, [file.id]);
      expect(onPolicyDraftReady).toHaveBeenCalledWith(
        deal.id,
        parsedResult.data,
        parsedResult.fileName,
        parsedResult.fileId,
        [parsedResult.fileId],
      );
    });

    expect(resultRef.current?.recognitionResults).toEqual([parsedResult]);
  });

  it('recognizes selected image files as documents', async () => {
    const deal = createDeal();
    const file = {
      id: 'file-img-1',
      name: 'passport.jpg',
      mimeType: 'image/jpeg',
      size: 2048,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://drive.google.com/file',
      isFolder: false,
      parentId: null,
    };
    fetchDealDriveFilesMock.mockResolvedValue({ files: [file], folderId: null });
    recognizeDealDocumentsMock.mockResolvedValueOnce({
      noteId: 'note-1',
      results: [
        {
          fileId: file.id,
          fileName: file.name,
          status: 'parsed',
          doc: {
            rawType: 'passport',
            normalizedType: 'passport',
            confidence: 0.91,
            warnings: [],
            fields: { number: '1234 567890' },
            validation: { accepted: ['number'], rejected: {} },
            extractedText: '',
          },
          transcript: '{"document_type":"passport"}',
          error: null,
        },
      ],
    });

    const onRefreshNotes = vi.fn().mockResolvedValue(undefined);
    const { resultRef } = renderDriveHook(deal, { onRefreshNotes });
    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });
    act(() => {
      resultRef.current?.toggleDriveFileSelection(file.id);
    });
    await act(async () => {
      await resultRef.current?.handleRecognizeDocuments();
    });

    await waitFor(() => {
      expect(recognizeDealDocumentsMock).toHaveBeenCalledWith(deal.id, [file.id]);
      expect(resultRef.current?.documentRecognitionResults[0]?.doc?.rawType).toBe('passport');
      expect(resultRef.current?.documentRecognitionResults[0]?.transcript).toBe(
        '{"document_type":"passport"}',
      );
      expect(onRefreshNotes).toHaveBeenCalledTimes(1);
    });
  });

  it('trashes a single file when confirmed', async () => {
    const deal = createDeal();
    const file = {
      id: 'file-1',
      name: 'policy.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://drive.google.com/file',
      isFolder: false,
      parentId: null,
    };
    fetchDealDriveFilesMock.mockResolvedValue({ files: [file], folderId: null });
    trashDealDriveFilesMock.mockResolvedValue({
      movedFileIds: [file.id],
      trashFolderId: 'trash-1',
    });
    const onConfirmDeleteFile = vi.fn().mockResolvedValue(true);
    const { resultRef } = renderDriveHook(deal, { onConfirmDeleteFile });

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });
    await act(async () => {
      await resultRef.current?.handleTrashDriveFile(file);
    });

    expect(onConfirmDeleteFile).toHaveBeenCalledWith(file.name);
    expect(trashDealDriveFilesMock).toHaveBeenCalledWith(deal.id, [file.id], false);
    expect(fetchDealDriveFilesMock).toHaveBeenCalledTimes(2);
  });

  it('does not trash a single file when deletion is canceled', async () => {
    const deal = createDeal();
    const file = {
      id: 'file-1',
      name: 'policy.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://drive.google.com/file',
      isFolder: false,
      parentId: null,
    };
    const onConfirmDeleteFile = vi.fn().mockResolvedValue(false);
    const { resultRef } = renderDriveHook(deal, { onConfirmDeleteFile });

    await act(async () => {
      await resultRef.current?.handleTrashDriveFile(file);
    });

    expect(onConfirmDeleteFile).toHaveBeenCalledWith(file.name);
    expect(trashDealDriveFilesMock).not.toHaveBeenCalled();
  });

  it('returns blob for image preview request', async () => {
    const deal = createDeal();
    const blob = new Blob(['image-bytes'], { type: 'image/png' });
    downloadDealDriveFilesMock.mockResolvedValue({ blob, filename: 'photo.png' });
    const { resultRef } = renderDriveHook(deal);

    let receivedBlob: Blob | null = null;
    await act(async () => {
      receivedBlob = await resultRef.current?.getDriveFileBlob('image-1')!;
    });

    expect(downloadDealDriveFilesMock).toHaveBeenCalledWith(deal.id, ['image-1'], false);
    expect(receivedBlob).toBe(blob);
  });
});
