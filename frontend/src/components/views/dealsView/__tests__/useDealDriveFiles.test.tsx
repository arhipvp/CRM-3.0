import React, { useEffect } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import { useDealDriveFiles } from '../hooks/useDealDriveFiles';
import type { Deal } from '../../../../types';

vi.mock('../../../../api', () => ({
  APIError: class APIError extends Error {},
  fetchDealDriveFiles: vi.fn(),
  uploadDealDriveFile: vi.fn(),
  recognizeDealPolicies: vi.fn(),
  recognizeDealDocuments: vi.fn(),
}));

import {
  fetchDealDriveFiles,
  recognizeDealDocuments,
  recognizeDealPolicies,
} from '../../../../api';
const fetchDealDriveFilesMock = vi.mocked(fetchDealDriveFiles);
const recognizeDealPoliciesMock = vi.mocked(recognizeDealPolicies);
const recognizeDealDocumentsMock = vi.mocked(recognizeDealDocuments);

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
    };
    fetchDealDriveFilesMock.mockResolvedValue({ files: [file], folderId: null });
    recognizeDealDocumentsMock.mockResolvedValueOnce({
      noteId: 'note-1',
      results: [
        {
          fileId: file.id,
          fileName: file.name,
          status: 'parsed',
          documentType: 'passport',
          confidence: 0.91,
          warnings: [],
          data: { number: '1234 567890' },
          transcript: '{}',
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
      expect(resultRef.current?.documentRecognitionResults[0]?.documentType).toBe('passport');
      expect(onRefreshNotes).toHaveBeenCalledTimes(1);
    });
  });
});
