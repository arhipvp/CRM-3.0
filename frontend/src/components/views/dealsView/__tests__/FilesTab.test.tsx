import type { ComponentProps } from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { NotificationContext } from '../../../../contexts/NotificationContext';
import type { Deal, DriveFile } from '../../../../types';
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
  isRecognizing: false,
  recognitionResults: [],
  recognitionMessage: null,
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

const mockObjectUrlApi = (urls: string[] = ['blob:preview']) => {
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  let objectUrlIndex = 0;
  const createObjectURL = vi.fn(
    () => urls[Math.min(objectUrlIndex++, Math.max(urls.length - 1, 0))],
  );
  const revokeObjectURL = vi.fn();

  Object.defineProperty(URL, 'createObjectURL', {
    writable: true,
    value: createObjectURL,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    writable: true,
    value: revokeObjectURL,
  });

  return {
    createObjectURL,
    restore: () => {
      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        value: originalCreateObjectURL,
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true,
        value: originalRevokeObjectURL,
      });
    },
    revokeObjectURL,
  };
};

const driveFile = (overrides: Partial<DriveFile>): DriveFile => ({
  id: 'file',
  name: 'file.pdf',
  mimeType: 'application/pdf',
  isFolder: false,
  size: 10,
  ...overrides,
});

describe('FilesTab', () => {
  it('renders updated policy recognition button and hides document recognition action', () => {
    renderWithProviders();

    expect(
      screen.getByRole('button', { name: 'Распознать полис (PDF, DOC, DOCX)' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Распознать документы' })).not.toBeInTheDocument();
  });

  it('renders preview action for supported files and opens image modal', async () => {
    const getDriveFileBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
    const objectUrlApi = mockObjectUrlApi(['blob:preview-photo']);
    renderWithProviders({
      getDriveFileBlob,
      sortedDriveFiles: [
        driveFile({
          id: 'image-1',
          name: 'photo.png',
          mimeType: 'image/png',
        }),
        driveFile({
          id: 'pdf-1',
          name: 'doc.pdf',
          mimeType: 'application/pdf',
        }),
        driveFile({
          id: 'doc-1',
          name: 'contract.doc',
          mimeType: 'application/msword',
        }),
        driveFile({
          id: 'docx-1',
          name: 'policy.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
        driveFile({
          id: 'txt-1',
          name: 'notes.txt',
          mimeType: 'text/plain',
        }),
        driveFile({
          id: 'folder-1',
          name: 'Folder',
          mimeType: 'application/vnd.google-apps.folder',
          isFolder: true,
        }),
      ],
    });

    const previewButtons = screen.getAllByRole('button', { name: 'Просмотреть' });
    expect(previewButtons).toHaveLength(4);
    fireEvent.click(previewButtons[0]);

    expect(getDriveFileBlob).toHaveBeenCalledWith('image-1');
    expect(await screen.findByRole('img', { name: 'photo.png' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'doc.pdf' })).not.toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();

    objectUrlApi.restore();
  });

  it('opens PDF preview from blob', async () => {
    const getDriveFileBlob = vi
      .fn()
      .mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    const objectUrlApi = mockObjectUrlApi(['blob:preview-pdf']);

    renderWithProviders({
      getDriveFileBlob,
      sortedDriveFiles: [
        driveFile({
          id: 'pdf-1',
          name: 'policy.pdf',
          mimeType: 'application/pdf',
        }),
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Просмотреть' }));

    expect(getDriveFileBlob).toHaveBeenCalledWith('pdf-1');
    expect(await screen.findByTitle('Просмотр файла policy.pdf')).toHaveAttribute(
      'src',
      'blob:preview-pdf',
    );
    expect(objectUrlApi.createObjectURL).toHaveBeenCalledTimes(1);

    objectUrlApi.restore();
  });

  it('opens DOCX preview through Google Drive without downloading blob', async () => {
    const getDriveFileBlob = vi.fn().mockResolvedValue(new Blob(['docx']));
    const objectUrlApi = mockObjectUrlApi(['blob:should-not-be-used']);

    renderWithProviders({
      getDriveFileBlob,
      sortedDriveFiles: [
        driveFile({
          id: 'docx-1',
          name: 'policy.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          webViewLink: 'https://drive.google.com/file/d/docx-1/view',
        }),
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Просмотреть' }));

    expect(await screen.findByTitle('Просмотр файла policy.docx')).toHaveAttribute(
      'src',
      'https://drive.google.com/file/d/docx-1/preview',
    );
    expect(screen.getByRole('link', { name: 'Открыть в Google Drive' })).toHaveAttribute(
      'href',
      'https://drive.google.com/file/d/docx-1/view',
    );
    expect(getDriveFileBlob).not.toHaveBeenCalled();
    expect(objectUrlApi.createObjectURL).not.toHaveBeenCalled();

    objectUrlApi.restore();
  });

  it('navigates previewable files with buttons and keyboard without looping', async () => {
    const getDriveFileBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
    const objectUrlApi = mockObjectUrlApi(['blob:1', 'blob:2']);

    renderWithProviders({
      getDriveFileBlob,
      sortedDriveFiles: [
        driveFile({
          id: 'image-1',
          name: 'photo-1.png',
          mimeType: 'image/png',
        }),
        driveFile({
          id: 'pdf-1',
          name: 'policy.pdf',
          mimeType: 'application/pdf',
        }),
        driveFile({
          id: 'docx-1',
          name: 'contract.docx',
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        }),
      ],
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Просмотреть' })[0]);
    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Вперёд' }));
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    expect(getDriveFileBlob).toHaveBeenNthCalledWith(2, 'pdf-1');
    expect(screen.getByTitle('Просмотр файла policy.pdf')).toHaveAttribute('src', 'blob:2');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Вперёд' })).toBeEnabled();
    });
    fireEvent.keyDown(window, { key: 'ArrowRight', code: 'ArrowRight' });
    expect(await screen.findByText('3 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Вперёд' })).toBeDisabled();
    expect(getDriveFileBlob).toHaveBeenCalledTimes(2);
    expect(screen.getByTitle('Просмотр файла contract.docx')).toHaveAttribute(
      'src',
      'https://drive.google.com/file/d/docx-1/preview',
    );

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(getDriveFileBlob).toHaveBeenCalledTimes(2);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Назад' })).toBeEnabled();
    });
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(await screen.findByText('2 / 3')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(objectUrlApi.revokeObjectURL).toHaveBeenCalledWith('blob:2');

    objectUrlApi.restore();
  }, 10000);

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

  it('calls preview download and delete actions for current file', async () => {
    const handleDownloadDriveFiles = vi.fn().mockResolvedValue(undefined);
    const handleTrashDriveFile = vi.fn().mockResolvedValue(undefined);
    const getDriveFileBlob = vi
      .fn()
      .mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    const objectUrlApi = mockObjectUrlApi(['blob:preview-actions']);
    const file = driveFile({
      id: 'pdf-1',
      name: 'policy.pdf',
      mimeType: 'application/pdf',
    });

    renderWithProviders({
      getDriveFileBlob,
      handleDownloadDriveFiles,
      handleTrashDriveFile,
      sortedDriveFiles: [file],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Просмотреть' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Скачать' }));
    expect(handleDownloadDriveFiles).toHaveBeenCalledWith(['pdf-1']);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Удалить' }));
    await waitFor(() => {
      expect(handleTrashDriveFile).toHaveBeenCalledWith(file);
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    objectUrlApi.restore();
  });

  it('renames preview image via input and keeps extension', async () => {
    const handleRenameDriveFile = vi.fn().mockResolvedValue(undefined);
    const getDriveFileBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:preview-rename'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });

    renderWithProviders({
      handleRenameDriveFile,
      getDriveFileBlob,
      sortedDriveFiles: [
        {
          id: 'image-1',
          name: 'photo.png',
          mimeType: 'image/png',
          isFolder: false,
          size: 10,
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Просмотреть' }));
    expect(await screen.findByRole('img', { name: 'photo.png' })).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const renameInput = within(dialog).getByLabelText('Имя файла') as HTMLInputElement;
    await waitFor(() => {
      expect(renameInput.value).toBe('photo');
    });

    fireEvent.change(renameInput, { target: { value: 'photo-renamed' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Переименовать' }));

    await waitFor(() => {
      expect(handleRenameDriveFile).toHaveBeenCalledWith('image-1', 'photo-renamed.png');
    });

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('shows validation error for empty preview rename and does not submit', async () => {
    const user = userEvent.setup();
    const handleRenameDriveFile = vi.fn().mockResolvedValue(undefined);
    const getDriveFileBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:preview-rename-empty'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });

    renderWithProviders({
      handleRenameDriveFile,
      getDriveFileBlob,
      sortedDriveFiles: [
        {
          id: 'image-1',
          name: 'photo.png',
          mimeType: 'image/png',
          isFolder: false,
          size: 10,
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Просмотреть' }));
    expect(await screen.findByRole('img', { name: 'photo.png' })).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    const renameInput = within(dialog).getByLabelText('Имя файла') as HTMLInputElement;
    const renameForm = renameInput.closest('form');
    expect(renameForm).not.toBeNull();
    await user.click(renameInput);
    renameInput.setSelectionRange(0, renameInput.value.length);
    await user.keyboard('{Backspace}');
    await user.type(renameInput, '   ');
    fireEvent.submit(renameForm as HTMLFormElement);

    expect(
      await within(dialog).findByText('Название файла не должно быть пустым.'),
    ).toBeInTheDocument();
    expect(handleRenameDriveFile).not.toHaveBeenCalled();

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: originalRevokeObjectURL,
    });
  });

  it('disables preview rename controls while renaming', async () => {
    const getDriveFileBlob = vi.fn().mockResolvedValue(new Blob(['img'], { type: 'image/png' }));
    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:preview-rename-disabled'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });

    renderWithProviders({
      isRenaming: true,
      getDriveFileBlob,
      sortedDriveFiles: [
        {
          id: 'image-1',
          name: 'photo.png',
          mimeType: 'image/png',
          isFolder: false,
          size: 10,
        },
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Просмотреть' }));
    expect(await screen.findByRole('img', { name: 'photo.png' })).toBeInTheDocument();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByLabelText('Имя файла')).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Переименовать' })).toBeDisabled();

    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: originalRevokeObjectURL,
    });
  });
});
