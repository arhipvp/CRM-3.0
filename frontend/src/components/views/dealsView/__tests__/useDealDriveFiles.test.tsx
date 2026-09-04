import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { resetDrivePreviewBlobCacheForTests, useDealDriveFiles } from '../hooks/useDealDriveFiles';
import type { Deal } from '../../../../types';

vi.mock('../../../../api', () => ({
  APIError: class APIError extends Error {},
  fetchDealDriveFiles: vi.fn(),
  uploadDealDriveFile: vi.fn(),
  downloadDealDriveFiles: vi.fn(),
  trashDealDriveFiles: vi.fn(),
  renameDealDriveFile: vi.fn(),
  recognizeDealPolicies: vi.fn(),
}));

import {
  downloadDealDriveFiles,
  fetchDealDriveFiles,
  recognizeDealPolicies,
  trashDealDriveFiles,
  uploadDealDriveFile,
} from '../../../../api';
const downloadDealDriveFilesMock = vi.mocked(downloadDealDriveFiles);
const fetchDealDriveFilesMock = vi.mocked(fetchDealDriveFiles);
const recognizeDealPoliciesMock = vi.mocked(recognizeDealPolicies);
const trashDealDriveFilesMock = vi.mocked(trashDealDriveFiles);
const uploadDealDriveFileMock = vi.mocked(uploadDealDriveFile);

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
    onConfirmDeleteFile?: (fileName: string, isFolder: boolean) => Promise<boolean>;
    onRefreshPolicies?: () => Promise<void>;
    onPolicyDraftReady?: (
      dealId: string,
      parsed: Record<string, unknown>,
      fileName?: string | null,
      fileId?: string | null,
      parsedFileIds?: string[],
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
      onPolicyDraftReady: options?.onPolicyDraftReady,
    });
    useEffect(() => {
      resultRef.current = state;
    }, [state]);
    return null;
  };

  const utils = render(<Wrapper deal={deal} />);
  return {
    ...utils,
    resultRef,
    rerenderDeal: (nextDeal: Deal | null) => utils.rerender(<Wrapper deal={nextDeal} />),
  };
};

describe('useDealDriveFiles', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resetDrivePreviewBlobCacheForTests();
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

  it('loads folder children lazily and allows folder selection', async () => {
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

    expect(resultRef.current?.selectedDriveFileIds).toEqual([folder.id]);

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

  it('does not refresh a previously expanded folder that disappeared from the root', async () => {
    const deal = createDeal();
    const folder = {
      id: 'stale-folder',
      name: 'Stale folder',
      mimeType: 'application/vnd.google-apps.folder',
      size: null,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://drive.google.com/folder',
      isFolder: true,
      parentId: null,
    };
    fetchDealDriveFilesMock
      .mockResolvedValueOnce({ files: [folder], folderId: null })
      .mockRejectedValueOnce(new Error('Folder no longer exists'))
      .mockResolvedValue({ files: [], folderId: null });
    const { resultRef } = renderDriveHook(deal);

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });
    await act(async () => {
      resultRef.current?.toggleFolderExpanded(folder.id);
    });
    await waitFor(() => {
      expect(resultRef.current?.folderErrors[folder.id]).toBe('Folder no longer exists');
    });

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });

    expect(resultRef.current?.expandedFolderIds).toEqual(new Set());
    expect(resultRef.current?.folderErrors).toEqual({});
    expect(fetchDealDriveFilesMock).toHaveBeenCalledTimes(3);

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });

    expect(fetchDealDriveFilesMock).toHaveBeenCalledTimes(4);
    expect(fetchDealDriveFilesMock).toHaveBeenLastCalledWith(deal.id, false);
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

  it('recognizes selected documents and JPG/JPEG/PNG images and notifies about parsed drafts', async () => {
    const deal = createDeal();
    const files = [
      {
        id: 'file-1',
        name: 'policy.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        webViewLink: 'https://drive.google.com/file',
        isFolder: false,
        parentId: null,
      },
      {
        id: 'file-2',
        name: 'policy.doc',
        mimeType: 'application/msword',
        size: 1024,
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        webViewLink: 'https://drive.google.com/file',
        isFolder: false,
        parentId: null,
      },
      {
        id: 'file-3',
        name: 'policy.docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        size: 1024,
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        webViewLink: 'https://drive.google.com/file',
        isFolder: false,
        parentId: null,
      },
      {
        id: 'file-4',
        name: 'policy.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        webViewLink: 'https://drive.google.com/file',
        isFolder: false,
        parentId: null,
      },
      {
        id: 'file-5',
        name: 'policy.png',
        mimeType: 'image/png',
        size: 1024,
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        webViewLink: 'https://drive.google.com/file',
        isFolder: false,
        parentId: null,
      },
    ];
    const parsedResult = {
      fileId: files[0].id,
      status: 'parsed' as const,
      data: { foo: 'bar' },
      fileName: 'policy.pdf',
    };
    fetchDealDriveFilesMock.mockResolvedValue({ files, folderId: null });
    recognizeDealPoliciesMock.mockResolvedValueOnce({ results: [parsedResult] });

    const onPolicyDraftReady = vi.fn();
    const { resultRef } = renderDriveHook(deal, { onPolicyDraftReady });

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });

    act(() => {
      files.forEach((file) => resultRef.current?.toggleDriveFileSelection(file.id));
    });

    await act(async () => {
      await resultRef.current?.handleRecognizePolicies();
    });

    await waitFor(() => {
      expect(recognizeDealPoliciesMock).toHaveBeenCalledWith(
        deal.id,
        files.map((file) => file.id),
      );
      expect(onPolicyDraftReady).toHaveBeenCalledWith(
        deal.id,
        parsedResult.data,
        parsedResult.fileName,
        parsedResult.fileId,
        files.map((file) => file.id),
      );
    });

    expect(resultRef.current?.recognitionResults).toEqual([parsedResult]);
  });

  it('uploads policy documents and images, recognizes their ids and opens a policy draft', async () => {
    const deal = createDeal();
    const uploadedFiles = [
      {
        id: 'uploaded-1',
        name: 'policy.pdf',
        mimeType: 'application/pdf',
        size: 1024,
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        webViewLink: 'https://drive.google.com/file',
        isFolder: false,
        parentId: null,
      },
      {
        id: 'uploaded-2',
        name: 'policy.jpeg',
        mimeType: 'image/jpeg',
        size: 2048,
        createdAt: '2025-01-01T00:00:00Z',
        modifiedAt: '2025-01-01T00:00:00Z',
        webViewLink: 'https://drive.google.com/file',
        isFolder: false,
        parentId: null,
      },
    ];
    const parsedResult = {
      fileId: uploadedFiles[0].id,
      status: 'parsed' as const,
      data: { policy: { policy_number: '123' } },
      fileName: uploadedFiles[0].name,
    };
    uploadDealDriveFileMock
      .mockResolvedValueOnce(uploadedFiles[0])
      .mockResolvedValueOnce(uploadedFiles[1]);
    fetchDealDriveFilesMock.mockResolvedValue({ files: uploadedFiles, folderId: null });
    recognizeDealPoliciesMock.mockResolvedValueOnce({ results: [parsedResult] });
    const onPolicyDraftReady = vi.fn();
    const { resultRef } = renderDriveHook(deal, { onPolicyDraftReady });

    await act(async () => {
      await resultRef.current?.handleUploadAndRecognizePolicyFiles([
        new File(['pdf'], 'policy.pdf', { type: 'application/pdf' }),
        new File(['jpeg'], 'policy.jpeg'),
      ]);
    });

    expect(uploadDealDriveFileMock).toHaveBeenNthCalledWith(1, deal.id, expect.any(File), false);
    expect(uploadDealDriveFileMock).toHaveBeenNthCalledWith(2, deal.id, expect.any(File), false);
    expect(recognizeDealPoliciesMock).toHaveBeenCalledWith(
      deal.id,
      uploadedFiles.map((file) => file.id),
    );
    expect(onPolicyDraftReady).toHaveBeenCalledWith(
      deal.id,
      parsedResult.data,
      parsedResult.fileName,
      parsedResult.fileId,
      uploadedFiles.map((file) => file.id),
    );
  });

  it('clears the recognizing state after switching deals while recognition is pending', async () => {
    const deal = createDeal();
    const nextDeal = createDeal({ id: 'deal-2', title: 'Deal 2' });
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
    let resolveRecognition: (value: { results: [] }) => void;
    const pendingRecognition = new Promise<{ results: [] }>((resolve) => {
      resolveRecognition = resolve;
    });
    fetchDealDriveFilesMock.mockResolvedValue({ files: [file], folderId: null });
    recognizeDealPoliciesMock.mockReturnValueOnce(pendingRecognition);
    const { resultRef, rerenderDeal } = renderDriveHook(deal);

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });
    act(() => {
      resultRef.current?.toggleDriveFileSelection(file.id);
    });

    let recognition: Promise<void>;
    await act(async () => {
      recognition = resultRef.current!.handleRecognizePolicies();
      await Promise.resolve();
    });

    expect(resultRef.current?.isRecognizing).toBe(true);

    await act(async () => {
      rerenderDeal(nextDeal);
    });

    expect(resultRef.current?.isRecognizing).toBe(false);

    await act(async () => {
      resolveRecognition!({ results: [] });
      await recognition!;
    });

    expect(resultRef.current?.isRecognizing).toBe(false);
  });

  it('clears the recognizing state after switching deals during upload and recognition', async () => {
    const deal = createDeal();
    const nextDeal = createDeal({ id: 'deal-2', title: 'Deal 2' });
    const uploadedFile = {
      id: 'uploaded-1',
      name: 'policy.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: 'https://drive.google.com/file',
      isFolder: false,
      parentId: null,
    };
    let resolveRecognition: (value: { results: [] }) => void;
    const pendingRecognition = new Promise<{ results: [] }>((resolve) => {
      resolveRecognition = resolve;
    });
    uploadDealDriveFileMock.mockResolvedValueOnce(uploadedFile);
    fetchDealDriveFilesMock.mockResolvedValue({ files: [uploadedFile], folderId: null });
    recognizeDealPoliciesMock.mockReturnValueOnce(pendingRecognition);
    const { resultRef, rerenderDeal } = renderDriveHook(deal);

    let uploadAndRecognition: Promise<void>;
    await act(async () => {
      uploadAndRecognition = resultRef.current!.handleUploadAndRecognizePolicyFiles([
        new File(['pdf'], uploadedFile.name, { type: uploadedFile.mimeType }),
      ]);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(recognizeDealPoliciesMock).toHaveBeenCalledWith(deal.id, [uploadedFile.id]);
    });
    expect(resultRef.current?.isRecognizing).toBe(true);

    await act(async () => {
      rerenderDeal(nextDeal);
    });

    expect(resultRef.current?.isRecognizing).toBe(false);

    await act(async () => {
      resolveRecognition!({ results: [] });
      await uploadAndRecognition!;
    });

    expect(resultRef.current?.isRecognizing).toBe(false);
  });

  it('rejects unsupported policy upload files before uploading', async () => {
    const deal = createDeal();
    const { resultRef } = renderDriveHook(deal);

    await act(async () => {
      await resultRef.current?.handleUploadAndRecognizePolicyFiles([
        new File(['text'], 'notes.txt', { type: 'text/plain' }),
      ]);
    });

    expect(resultRef.current?.recognitionMessage).toBe(
      'Загрузите только файлы PDF, DOC, DOCX, JPG/JPEG или PNG.',
    );
    expect(uploadDealDriveFileMock).not.toHaveBeenCalled();
    expect(recognizeDealPoliciesMock).not.toHaveBeenCalled();
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

    expect(onConfirmDeleteFile).toHaveBeenCalledWith(file.name, false);
    expect(trashDealDriveFilesMock).toHaveBeenCalledWith(deal.id, [file.id], false);
    expect(fetchDealDriveFilesMock).toHaveBeenCalledTimes(2);
  });

  it('clears the deleting state after switching deals while deletion is pending', async () => {
    const deal = createDeal();
    const nextDeal = createDeal({ id: 'deal-2', title: 'Deal 2' });
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
    let resolveTrash: (value: { movedFileIds: string[]; trashFolderId: string }) => void;
    const pendingTrash = new Promise<{ movedFileIds: string[]; trashFolderId: string }>(
      (resolve) => {
        resolveTrash = resolve;
      },
    );
    trashDealDriveFilesMock.mockReturnValueOnce(pendingTrash);
    const onConfirmDeleteFile = vi.fn().mockResolvedValue(true);
    const { resultRef, rerenderDeal } = renderDriveHook(deal, { onConfirmDeleteFile });

    let deletion: Promise<void>;
    await act(async () => {
      deletion = resultRef.current!.handleTrashDriveFile(file);
      await Promise.resolve();
    });

    expect(resultRef.current?.isTrashing).toBe(true);

    await act(async () => {
      rerenderDeal(nextDeal);
    });

    expect(resultRef.current?.isTrashing).toBe(false);

    await act(async () => {
      resolveTrash!({ movedFileIds: [file.id], trashFolderId: 'trash-1' });
      await deletion!;
    });

    expect(resultRef.current?.isTrashing).toBe(false);
    expect(fetchDealDriveFilesMock).not.toHaveBeenCalled();
  });

  it('trashes an empty folder when confirmed', async () => {
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
    fetchDealDriveFilesMock.mockResolvedValue({ files: [folder], folderId: null });
    trashDealDriveFilesMock.mockResolvedValue({
      movedFileIds: [folder.id],
      trashFolderId: 'trash-1',
    });
    const onConfirmDeleteFile = vi.fn().mockResolvedValue(true);
    const { resultRef } = renderDriveHook(deal, { onConfirmDeleteFile });

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });
    await act(async () => {
      await resultRef.current?.handleTrashDriveFile(folder);
    });

    expect(onConfirmDeleteFile).toHaveBeenCalledWith(folder.name, true);
    expect(trashDealDriveFilesMock).toHaveBeenCalledWith(deal.id, [folder.id], false);
    expect(fetchDealDriveFilesMock).toHaveBeenCalledTimes(2);
  });

  it('does not recognize a selected folder', async () => {
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
    fetchDealDriveFilesMock.mockResolvedValue({ files: [folder], folderId: null });
    const { resultRef } = renderDriveHook(deal);

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });
    act(() => {
      resultRef.current?.toggleDriveFileSelection(folder.id);
    });
    await act(async () => {
      await resultRef.current?.handleRecognizePolicies();
    });

    expect(resultRef.current?.canRecognizeSelectedFiles).toBe(false);
    expect(resultRef.current?.recognitionMessage).toBe(
      'Выберите только файлы PDF, DOC, DOCX, JPG/JPEG или PNG.',
    );
    expect(recognizeDealPoliciesMock).not.toHaveBeenCalled();
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

    expect(onConfirmDeleteFile).toHaveBeenCalledWith(file.name, false);
    expect(trashDealDriveFilesMock).not.toHaveBeenCalled();
  });

  it('returns blob for image preview request', async () => {
    const deal = createDeal();
    const blob = new Blob(['image-bytes'], { type: 'image/png' });
    downloadDealDriveFilesMock.mockResolvedValue({ blob, filename: 'photo.png' });
    const { resultRef } = renderDriveHook(deal);

    expect(resultRef.current).not.toBeNull();
    let receivedBlob: Blob | null = null;
    await act(async () => {
      receivedBlob = await resultRef.current!.getDriveFileBlob('image-1');
    });

    expect(downloadDealDriveFilesMock).toHaveBeenCalledWith(deal.id, ['image-1'], false);
    expect(receivedBlob).toBe(blob);
  });

  it('deduplicates and caches image preview downloads for the current browser session', async () => {
    const deal = createDeal();
    const image = {
      id: 'image-1',
      name: 'photo.png',
      mimeType: 'image/png',
      size: 1024,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: null,
      isFolder: false,
      parentId: null,
    };
    fetchDealDriveFilesMock.mockResolvedValue({ files: [image], folderId: null });
    const blob = new Blob(['image-bytes'], { type: 'image/png' });
    let resolveDownload: ((value: { blob: Blob; filename: string | null }) => void) | undefined;
    downloadDealDriveFilesMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDownload = resolve;
        }),
    );
    const { resultRef } = renderDriveHook(deal);

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });

    const firstRequest = resultRef.current!.getDriveFileBlob(image.id);
    const secondRequest = resultRef.current!.getDriveFileBlob(image.id);
    expect(downloadDealDriveFilesMock).toHaveBeenCalledTimes(1);

    resolveDownload?.({ blob, filename: image.name });
    await expect(firstRequest).resolves.toBe(blob);
    await expect(secondRequest).resolves.toBe(blob);
    await expect(resultRef.current!.getDriveFileBlob(image.id)).resolves.toBe(blob);
    expect(downloadDealDriveFilesMock).toHaveBeenCalledTimes(1);
  });

  it('does not retain preview images larger than the memory cache limit per file', async () => {
    const deal = createDeal();
    const image = {
      id: 'image-1',
      name: 'large-photo.png',
      mimeType: 'image/png',
      size: 16 * 1024 * 1024,
      createdAt: '2025-01-01T00:00:00Z',
      modifiedAt: '2025-01-01T00:00:00Z',
      webViewLink: null,
      isFolder: false,
      parentId: null,
    };
    fetchDealDriveFilesMock.mockResolvedValue({ files: [image], folderId: null });
    const oversizedBlob = { size: 16 * 1024 * 1024, type: 'image/png' } as Blob;
    downloadDealDriveFilesMock.mockResolvedValue({ blob: oversizedBlob, filename: image.name });
    const { resultRef } = renderDriveHook(deal);

    await act(async () => {
      await resultRef.current?.loadDriveFiles();
    });
    await act(async () => {
      await resultRef.current!.getDriveFileBlob(image.id);
      await resultRef.current!.getDriveFileBlob(image.id);
    });

    expect(downloadDealDriveFilesMock).toHaveBeenCalledTimes(2);
  });
});
