import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { NotificationContext } from '../../../../contexts/NotificationContext';
import type { Deal } from '../../../../types';
import { FilesTab } from '../tabs/FilesTab';

const selectedDeal: Deal = {
  id: 'deal-1',
  title: 'Deal',
  clientId: 'client-1',
  clientName: 'Client',
  status: 'open',
  createdAt: '2025-01-01T00:00:00Z',
  quotes: [],
  documents: [],
  driveFolderId: 'folder-1',
  deletedAt: null,
};

const baseProps: ComponentProps<typeof FilesTab> = {
  selectedDeal,
  isDriveLoading: false,
  loadDriveFiles: vi.fn().mockResolvedValue(undefined),
  onUploadDriveFile: vi.fn().mockResolvedValue(undefined),
  isSelectedDealDeleted: false,
  selectedDriveFileIds: [],
  toggleDriveFileSelection: vi.fn(),
  handleRecognizePolicies: vi.fn().mockResolvedValue(undefined),
  handleRecognizeDocuments: vi.fn().mockResolvedValue(undefined),
  isRecognizing: false,
  recognitionResults: [],
  recognitionMessage: null,
  isDocumentRecognizing: false,
  documentRecognitionResults: [],
  documentRecognitionMessage: null,
  isTrashing: false,
  trashMessage: null,
  handleTrashSelectedFiles: vi.fn().mockResolvedValue(undefined),
  handleTrashDriveFile: vi.fn().mockResolvedValue(undefined),
  isDownloading: false,
  downloadMessage: null,
  handleDownloadDriveFiles: vi.fn().mockResolvedValue(undefined),
  getDriveFileBlob: vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' })),
  driveError: null,
  sortedDriveFiles: [],
  expandedFolderIds: new Set<string>(),
  toggleFolderExpanded: vi.fn(),
  isFolderLoading: vi.fn().mockReturnValue(false),
  getDriveFileDepth: vi.fn().mockReturnValue(0),
  canRecognizeSelectedFiles: false,
  canRecognizeSelectedDocumentFiles: false,
  driveSortDirection: 'desc' as const,
  toggleDriveSortDirection: vi.fn(),
  isRenaming: false,
  renameMessage: null,
  handleRenameDriveFile: vi.fn().mockResolvedValue(undefined),
  isCreatingMailbox: false,
  isCheckingMailbox: false,
  mailboxActionError: null,
  mailboxActionSuccess: null,
  onCreateMailbox: vi.fn().mockResolvedValue(undefined),
  onCheckMailbox: vi.fn().mockResolvedValue(undefined),
};

const notificationContextValue = {
  notifications: [],
  addNotification: vi.fn(),
  removeNotification: vi.fn(),
};

const renderWithProviders = (props: Partial<typeof baseProps> = {}) =>
  render(
    <NotificationContext.Provider value={notificationContextValue}>
      <FilesTab {...baseProps} {...props} />
    </NotificationContext.Provider>,
  );

describe('FilesTab document recognition transcript', () => {
  it('renders transcript spoiler when transcript is present', () => {
    renderWithProviders({
      documentRecognitionResults: [
        {
          fileId: 'file-1',
          fileName: 'sts.jpg',
          status: 'parsed',
          transcript: '{"raw":"log"}',
          doc: {
            rawType: 'sts',
            normalizedType: 'sts',
            confidence: 1,
            warnings: [],
            fields: { owner: 'ИВАНОВ ИВАН' },
            validation: { accepted: ['owner'], rejected: {} },
            extractedText: 'text',
          },
          error: null,
        },
      ],
    });

    const detailsSummary = screen.getByText('Показать транскрипт');
    expect(detailsSummary).toBeInTheDocument();

    fireEvent.click(detailsSummary);
    expect(screen.getByText('{"raw":"log"}')).toBeInTheDocument();
  });

  it('does not render transcript spoiler when transcript is empty', () => {
    renderWithProviders({
      documentRecognitionResults: [
        {
          fileId: 'file-1',
          fileName: 'sts.jpg',
          status: 'parsed',
          transcript: null,
          doc: {
            rawType: 'sts',
            normalizedType: 'sts',
            confidence: 1,
            warnings: [],
            fields: { owner: 'ИВАНОВ ИВАН' },
            validation: { accepted: ['owner'], rejected: {} },
            extractedText: 'text',
          },
          error: null,
        },
      ],
    });

    expect(screen.queryByText('Показать транскрипт')).not.toBeInTheDocument();
  });

  it('renders preview action only for image files and opens modal', async () => {
    const getDriveFileBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:preview-photo'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });
    renderWithProviders({
      getDriveFileBlob,
      sortedDriveFiles: [
        {
          id: 'image-1',
          name: 'photo.png',
          mimeType: 'image/png',
          isFolder: false,
          size: 10,
        },
        {
          id: 'pdf-1',
          name: 'doc.pdf',
          mimeType: 'application/pdf',
          isFolder: false,
          size: 20,
        },
      ],
    });

    const previewButtons = screen.getAllByRole('button', { name: 'Просмотреть' });
    expect(previewButtons).toHaveLength(1);
    fireEvent.click(previewButtons[0]);

    expect(getDriveFileBlob).toHaveBeenCalledWith('image-1');
    expect(await screen.findByRole('img', { name: 'photo.png' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'doc.pdf' })).not.toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('navigates images with buttons and keyboard without looping', async () => {
    const getDriveFileBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const objectUrls = ['blob:1', 'blob:2', 'blob:3'];
    let objectUrlIndex = 0;
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => objectUrls[Math.min(objectUrlIndex++, objectUrls.length - 1)]),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });

    renderWithProviders({
      getDriveFileBlob,
      sortedDriveFiles: [
        {
          id: 'image-1',
          name: 'photo-1.png',
          mimeType: 'image/png',
          isFolder: false,
          size: 10,
        },
        {
          id: 'image-2',
          name: 'photo-2.png',
          mimeType: 'image/png',
          isFolder: false,
          size: 10,
        },
        {
          id: 'image-3',
          name: 'photo-3.png',
          mimeType: 'image/png',
          isFolder: false,
          size: 10,
        },
      ],
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Просмотреть' })[0]);
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Вперёд' }));
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    expect(getDriveFileBlob).toHaveBeenNthCalledWith(2, 'image-2');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Вперёд' })).toBeEnabled();
    });
    fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(await screen.findByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вперёд' })).toBeDisabled();
    expect(getDriveFileBlob).toHaveBeenNthCalledWith(3, 'image-3');

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(getDriveFileBlob).toHaveBeenCalledTimes(3);

    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('img', { name: 'photo-2.png' })).not.toBeInTheDocument();

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('calls per-file delete handler', () => {
    const handleTrashDriveFile = vi.fn().mockResolvedValue(undefined);
    renderWithProviders({
      handleTrashDriveFile,
      sortedDriveFiles: [
        {
          id: 'file-1',
          name: 'doc.pdf',
          mimeType: 'application/pdf',
          isFolder: false,
          size: 20,
        },
      ],
    });

    const deleteButtons = screen.getAllByRole('button', { name: 'Удалить' });
    fireEvent.click(deleteButtons[1]);
    expect(handleTrashDriveFile).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'file-1', name: 'doc.pdf' }),
    );
  });
});
