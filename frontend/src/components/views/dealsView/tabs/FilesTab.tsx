import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Deal, DriveFile, PolicyRecognitionResult } from '../../../../types';
import { FileUploadManager } from '../../../FileUploadManager';
import { buildDriveFolderLink } from '../../../../utils/links';
import { copyToClipboard } from '../../../../utils/clipboard';
import { useNotification } from '../../../../contexts/NotificationContext';
import {
  BTN_BLOCK_PRIMARY,
  BTN_BLOCK_SECONDARY,
  BTN_SM_DANGER,
  BTN_SM_PRIMARY,
  BTN_SM_SECONDARY,
} from '../../../common/buttonStyles';
import { DriveFilesTable } from '../../../common/table/DriveFilesTable';
import {
  CONTENT_SECTION_DIVIDER,
  LINK_ACTION_XS,
  LOADING_SPINNER_SM,
  MODAL_INPUT_SHELL,
  PANEL_MUTED_TEXT,
  PANEL_SECTION,
  RESULT_CARD,
  SECTION_META_TEXT,
  STATUS_BADGE_DANGER_XS,
} from '../../../common/uiClassNames';
import { InlineAlert } from '../../../common/InlineAlert';
import { Modal } from '../../../Modal';
import { formatDriveDate, formatDriveFileSize, formatRecognitionSummary } from '../helpers';

interface FilesTabProps {
  selectedDeal: Deal | null;
  isDriveLoading: boolean;
  loadDriveFiles: () => Promise<void>;
  onUploadDriveFile: (file: File) => Promise<void>;
  isSelectedDealDeleted: boolean;
  selectedDriveFileIds: string[];
  toggleDriveFileSelection: (fileId: string) => void;
  handleRecognizePolicies: () => Promise<void>;
  isRecognizing: boolean;
  recognitionResults: PolicyRecognitionResult[];
  recognitionMessage: string | null;
  isTrashing: boolean;
  trashMessage: string | null;
  handleTrashSelectedFiles: () => Promise<void>;
  handleTrashDriveFile: (file: DriveFile) => Promise<void>;
  isDownloading: boolean;
  downloadMessage: string | null;
  handleDownloadDriveFiles: (fileIds?: string[]) => Promise<void>;
  getDriveFileBlob: (fileId: string) => Promise<Blob>;
  driveError: string | null;
  sortedDriveFiles: DriveFile[];
  expandedFolderIds: Set<string>;
  toggleFolderExpanded: (folderId: string) => void;
  isFolderLoading: (folderId: string) => boolean;
  getDriveFileDepth: (fileId: string) => number;
  canRecognizeSelectedFiles: boolean;
  driveSortDirection: 'asc' | 'desc';
  toggleDriveSortDirection: () => void;
  isRenaming: boolean;
  renameMessage: string | null;
  handleRenameDriveFile: (fileId: string, name: string) => Promise<void>;
  isCreatingMailbox: boolean;
  isCheckingMailbox: boolean;
  mailboxActionError: string | null;
  mailboxActionSuccess: string | null;
  onCreateMailbox: () => Promise<void>;
  onCheckMailbox: () => Promise<void>;
}

type FilePreviewKind = 'image' | 'pdf' | 'drive';

interface FilePreviewState {
  file: DriveFile;
  kind: FilePreviewKind;
  src: string;
}

interface HeaderActionButtonProps {
  onClick: () => void | Promise<void>;
  disabled: boolean;
  className: string;
  children: ReactNode;
}

interface ActionLinkButtonProps {
  onClick: () => void | Promise<void>;
  disabled: boolean;
  children: ReactNode;
}

interface RecognitionResultsProps {
  results: PolicyRecognitionResult[];
}

const FILE_ACTION_LINK_CLASS = `${LINK_ACTION_XS} disabled:text-slate-300`;
const SORT_HEADER_BUTTON_CLASS =
  'flex w-full items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white';
const SORT_HEADER_TITLE_CLASS =
  'text-[11px] font-semibold uppercase tracking-wide text-rose-600 underline decoration-rose-500 decoration-2 underline-offset-2';
const SORT_HEADER_VALUE_CLASS = 'text-[11px] font-semibold uppercase tracking-wide text-slate-900';
const PREVIEW_RENAME_INPUT_CLASS =
  'min-w-0 flex-1 border-none bg-transparent p-0 text-sm text-slate-700 outline-none disabled:cursor-not-allowed disabled:text-slate-400';
const RENAME_INPUT_CLASS =
  'min-w-0 flex-1 border-none bg-transparent p-0 text-sm text-slate-700 outline-none';
const PDF_MIME_TYPE = 'application/pdf';
const DOC_MIME_TYPE = 'application/msword';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function HeaderActionButton({ onClick, disabled, className, children }: HeaderActionButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
      className={className}
    >
      {children}
    </button>
  );
}

function ActionLinkButton({ onClick, disabled, children }: ActionLinkButtonProps) {
  return (
    <button
      type="button"
      onClick={() => {
        void onClick();
      }}
      disabled={disabled}
      className={FILE_ACTION_LINK_CLASS}
    >
      {children}
    </button>
  );
}

function RecognitionResults({ results }: RecognitionResultsProps) {
  if (!results.length) {
    return null;
  }

  return (
    <div className={RESULT_CARD}>
      {results.map((result) => (
        <div key={`${result.fileId}-${result.status}`} className="space-y-1">
          <p className="font-semibold text-slate-900">{result.fileName ?? result.fileId}</p>
          <p
            className={`text-[11px] ${
              result.status === 'error'
                ? 'text-rose-600'
                : result.status === 'exists'
                  ? 'text-amber-600'
                  : 'text-slate-500'
            }`}
          >
            {formatRecognitionSummary(result)}
          </p>
          {result.transcript && (
            <details className="text-[10px] text-slate-400">
              <summary>Показать транскрипт</summary>
              <pre className="whitespace-pre-wrap text-[11px] leading-snug">
                {result.transcript}
              </pre>
            </details>
          )}
        </div>
      ))}
    </div>
  );
}

export function FilesTab({
  selectedDeal,
  isDriveLoading,
  loadDriveFiles,
  onUploadDriveFile,
  isSelectedDealDeleted,
  selectedDriveFileIds,
  toggleDriveFileSelection,
  handleRecognizePolicies,
  isRecognizing,
  recognitionResults,
  recognitionMessage,
  isTrashing,
  trashMessage,
  handleTrashSelectedFiles,
  handleTrashDriveFile,
  isDownloading,
  downloadMessage,
  handleDownloadDriveFiles,
  getDriveFileBlob,
  driveError,
  canRecognizeSelectedFiles,
  sortedDriveFiles,
  expandedFolderIds,
  toggleFolderExpanded,
  isFolderLoading,
  getDriveFileDepth,
  driveSortDirection,
  toggleDriveSortDirection,
  isRenaming,
  renameMessage,
  handleRenameDriveFile,
  isCreatingMailbox,
  isCheckingMailbox,
  mailboxActionError,
  mailboxActionSuccess,
  onCreateMailbox,
  onCheckMailbox,
}: FilesTabProps) {
  const { addNotification } = useNotification();
  const [renamingFile, setRenamingFile] = useState<DriveFile | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreviewState | null>(null);
  const [previewRenameDraft, setPreviewRenameDraft] = useState('');
  const [previewRenameError, setPreviewRenameError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const filePreviewSrcRef = useRef<string | null>(null);

  const splitFileName = useCallback((name: string): { baseName: string; extension: string } => {
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex <= 0 || lastDotIndex === name.length - 1) {
      return { baseName: name, extension: '' };
    }

    return {
      baseName: name.slice(0, lastDotIndex),
      extension: name.slice(lastDotIndex),
    };
  }, []);

  const renderStatusMessage = (message: string, tone: 'default' | 'danger' = 'default') => {
    if (tone === 'danger') {
      return <InlineAlert>{message}</InlineAlert>;
    }
    return <div className={PANEL_MUTED_TEXT}>{message}</div>;
  };

  const disableUpload = !selectedDeal?.driveFolderId;
  const driveFolderLink = buildDriveFolderLink(selectedDeal?.driveFolderId);
  const mailboxEmail = (selectedDeal?.mailboxEmail ?? '').trim();
  const sortIndicator = driveSortDirection === 'asc' ? '↑' : '↓';
  const sortLabel = driveSortDirection === 'asc' ? 'по возрастанию' : 'по убыванию';
  const getAriaSort = (): 'ascending' | 'descending' =>
    driveSortDirection === 'asc' ? 'ascending' : 'descending';
  const isRenameDisabled =
    isRenaming ||
    isDriveLoading ||
    isTrashing ||
    isDownloading ||
    isSelectedDealDeleted ||
    !selectedDeal?.driveFolderId;

  const openRenameModal = (file: DriveFile) => {
    const { baseName } = splitFileName(file.name);
    setRenamingFile(file);
    setRenameDraft(baseName);
    setRenameError(null);
  };

  const closeRenameModal = () => {
    setRenamingFile(null);
    setRenameDraft('');
    setRenameError(null);
  };

  const isImageFile = useCallback(
    (file: DriveFile) => !file.isFolder && file.mimeType?.toLowerCase().startsWith('image/'),
    [],
  );

  const getNormalizedFileName = useCallback((file: DriveFile) => file.name.toLowerCase(), []);

  const isPdfFile = useCallback(
    (file: DriveFile) =>
      !file.isFolder &&
      (file.mimeType?.toLowerCase() === PDF_MIME_TYPE ||
        getNormalizedFileName(file).endsWith('.pdf')),
    [getNormalizedFileName],
  );

  const isWordFile = useCallback(
    (file: DriveFile) => {
      if (file.isFolder) {
        return false;
      }
      const mimeType = file.mimeType?.toLowerCase();
      const normalizedName = getNormalizedFileName(file);
      return (
        mimeType === DOC_MIME_TYPE ||
        mimeType === DOCX_MIME_TYPE ||
        normalizedName.endsWith('.doc') ||
        normalizedName.endsWith('.docx')
      );
    },
    [getNormalizedFileName],
  );

  const getFilePreviewKind = useCallback(
    (file: DriveFile): FilePreviewKind | null => {
      if (isImageFile(file)) {
        return 'image';
      }
      if (isPdfFile(file)) {
        return 'pdf';
      }
      if (isWordFile(file)) {
        return 'drive';
      }
      return null;
    },
    [isImageFile, isPdfFile, isWordFile],
  );

  const isPreviewableFile = useCallback(
    (file: DriveFile) => getFilePreviewKind(file) !== null,
    [getFilePreviewKind],
  );

  const previewableFiles = useMemo(
    () => sortedDriveFiles.filter((file) => isPreviewableFile(file)),
    [isPreviewableFile, sortedDriveFiles],
  );

  const currentPreviewIndex = useMemo(() => {
    if (!filePreview) {
      return -1;
    }
    return previewableFiles.findIndex((file) => file.id === filePreview.file.id);
  }, [filePreview, previewableFiles]);
  const canGoPrev = currentPreviewIndex > 0;
  const canGoNext = currentPreviewIndex >= 0 && currentPreviewIndex < previewableFiles.length - 1;
  const previewRenameExtension = filePreview ? splitFileName(filePreview.file.name).extension : '';
  const isPreviewRenameDisabled =
    isRenaming ||
    isDriveLoading ||
    isTrashing ||
    isDownloading ||
    isSelectedDealDeleted ||
    !filePreview;

  const closeFilePreview = useCallback(() => {
    setFilePreview((prev) => {
      if (prev?.src.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(prev.src);
      }
      return null;
    });
    setPreviewRenameDraft('');
    setPreviewRenameError(null);
    setPreviewError(null);
    setIsPreviewLoading(false);
  }, []);

  const openFileByIndex = useCallback(
    async (index: number) => {
      if (index < 0 || index >= previewableFiles.length) {
        return;
      }
      const targetFile = previewableFiles[index];
      const previewKind = getFilePreviewKind(targetFile);
      if (!previewKind) {
        return;
      }
      setIsPreviewLoading(true);
      setPreviewError(null);
      try {
        let nextSrc = '';
        if (previewKind === 'drive') {
          nextSrc = `https://drive.google.com/file/d/${encodeURIComponent(targetFile.id)}/preview`;
        } else {
          const blob = await getDriveFileBlob(targetFile.id);
          if (typeof URL.createObjectURL !== 'function') {
            throw new Error('URL.createObjectURL is not available');
          }
          nextSrc = URL.createObjectURL(blob);
        }
        setFilePreview((prev) => {
          if (prev?.src.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
            URL.revokeObjectURL(prev.src);
          }
          return { file: targetFile, kind: previewKind, src: nextSrc };
        });
      } catch (error) {
        console.error('Ошибка предпросмотра файла:', error);
        setPreviewError('Не удалось загрузить файл для просмотра.');
      } finally {
        setIsPreviewLoading(false);
      }
    },
    [getDriveFileBlob, getFilePreviewKind, previewableFiles],
  );

  const handlePreviewFile = async (file: DriveFile) => {
    if (!isPreviewableFile(file)) {
      return;
    }
    const targetIndex = previewableFiles.findIndex((candidate) => candidate.id === file.id);
    if (targetIndex === -1) {
      return;
    }
    await openFileByIndex(targetIndex);
  };

  const goToPrevFile = useCallback(() => {
    if (!canGoPrev || isPreviewLoading) {
      return;
    }
    void openFileByIndex(currentPreviewIndex - 1);
  }, [canGoPrev, currentPreviewIndex, isPreviewLoading, openFileByIndex]);

  const goToNextFile = useCallback(() => {
    if (!canGoNext || isPreviewLoading) {
      return;
    }
    void openFileByIndex(currentPreviewIndex + 1);
  }, [canGoNext, currentPreviewIndex, isPreviewLoading, openFileByIndex]);

  const handlePreviewRenameSubmit = useCallback(
    async (draftOverride?: string) => {
      if (!filePreview) {
        return;
      }

      const trimmedBaseName = (draftOverride ?? previewRenameDraft).trim();
      if (!trimmedBaseName) {
        setPreviewRenameError('Название файла не должно быть пустым.');
        return;
      }

      setPreviewRenameError(null);
      await handleRenameDriveFile(
        filePreview.file.id,
        `${trimmedBaseName}${splitFileName(filePreview.file.name).extension}`,
      );
    },
    [filePreview, handleRenameDriveFile, previewRenameDraft, splitFileName],
  );

  useEffect(() => {
    filePreviewSrcRef.current = filePreview?.src ?? null;
  }, [filePreview?.src]);

  useEffect(
    () => () => {
      const previewSrc = filePreviewSrcRef.current;
      if (previewSrc?.startsWith('blob:') && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(previewSrc);
      }
    },
    [],
  );

  useEffect(() => {
    if (!filePreview) {
      return;
    }
    const isCurrentPreviewInList = previewableFiles.some((file) => file.id === filePreview.file.id);
    if (!isCurrentPreviewInList) {
      closeFilePreview();
    }
  }, [closeFilePreview, filePreview, previewableFiles]);

  useEffect(() => {
    if (!filePreview) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeFilePreview();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToPrevFile();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToNextFile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeFilePreview, filePreview, goToNextFile, goToPrevFile]);

  useEffect(() => {
    if (!filePreview) {
      setPreviewRenameDraft('');
      setPreviewRenameError(null);
      return;
    }
    const { baseName } = splitFileName(filePreview.file.name);
    setPreviewRenameDraft(baseName);
    setPreviewRenameError(null);
  }, [filePreview, splitFileName]);

  useEffect(() => {
    if (!filePreview) {
      return;
    }
    const previewFile = sortedDriveFiles.find((file) => file.id === filePreview.file.id);
    if (!previewFile || previewFile.name === filePreview.file.name) {
      return;
    }
    setFilePreview((prev) =>
      prev && prev.file.id === previewFile.id ? { ...prev, file: previewFile } : prev,
    );
  }, [filePreview, sortedDriveFiles]);

  const handlePreviewDelete = useCallback(async () => {
    if (!filePreview) {
      return;
    }
    await handleTrashDriveFile(filePreview.file);
    closeFilePreview();
  }, [closeFilePreview, filePreview, handleTrashDriveFile]);

  if (!selectedDeal) {
    return null;
  }

  const handleRenameSubmit = async () => {
    if (!renamingFile) {
      return;
    }
    const trimmedBaseName = renameDraft.trim();
    if (!trimmedBaseName) {
      setRenameError('Название файла не должно быть пустым.');
      return;
    }
    const { extension } = splitFileName(renamingFile.name);
    await handleRenameDriveFile(renamingFile.id, `${trimmedBaseName}${extension}`);
    closeRenameModal();
  };

  const renameExtension = renamingFile ? splitFileName(renamingFile.name).extension : '';

  return (
    <section className={`${PANEL_SECTION} space-y-5`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="app-label">Файлы</p>
            {isDriveLoading && (
              <span className={LOADING_SPINNER_SM} aria-label="Идет загрузка файлов" />
            )}
            {driveFolderLink && (
              <a href={driveFolderLink} target="_blank" rel="noreferrer" className={LINK_ACTION_XS}>
                Открыть папку в Google Drive
              </a>
            )}
          </div>
          <p className={SECTION_META_TEXT}>
            Файлы загружаются прямо из папки, привязанной к этой сделке.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!selectedDeal.mailboxEmail && (
            <HeaderActionButton
              onClick={onCreateMailbox}
              disabled={isCreatingMailbox || isCheckingMailbox}
              className={BTN_SM_PRIMARY}
            >
              {isCreatingMailbox ? 'Создаю ящик...' : 'Создать почту сделки'}
            </HeaderActionButton>
          )}
          <HeaderActionButton
            onClick={onCheckMailbox}
            disabled={!selectedDeal.mailboxEmail || isCheckingMailbox || isCreatingMailbox}
            className={BTN_SM_SECONDARY}
          >
            {isCheckingMailbox ? 'Проверяем почту...' : 'Проверить почту'}
          </HeaderActionButton>
          <HeaderActionButton
            onClick={loadDriveFiles}
            disabled={!selectedDeal.driveFolderId || isDriveLoading}
            className={BTN_SM_SECONDARY}
          >
            {isDriveLoading ? 'Обновляю...' : 'Обновить'}
          </HeaderActionButton>
        </div>
      </div>
      {mailboxEmail && (
        <p className={SECTION_META_TEXT}>
          Почта сделки:{' '}
          <button
            type="button"
            className={LINK_ACTION_XS}
            onClick={async (event) => {
              event.stopPropagation();
              const copied = await copyToClipboard(mailboxEmail);
              if (copied) {
                addNotification('Почта скопирована', 'success', 1600);
              }
            }}
            aria-label="Скопировать почту сделки"
            title="Скопировать почту сделки"
          >
            {mailboxEmail}
          </button>
        </p>
      )}
      {mailboxActionError && <InlineAlert>{mailboxActionError}</InlineAlert>}
      {mailboxActionSuccess && <InlineAlert tone="success">{mailboxActionSuccess}</InlineAlert>}

      <FileUploadManager
        onUpload={async (file) => {
          await onUploadDriveFile(file);
          await loadDriveFiles();
        }}
        disabled={disableUpload || isSelectedDealDeleted}
      />

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          type="button"
          onClick={handleRecognizePolicies}
          disabled={
            isRecognizing ||
            isTrashing ||
            isDownloading ||
            !selectedDeal.driveFolderId ||
            selectedDriveFileIds.length === 0 ||
            !canRecognizeSelectedFiles ||
            !!driveError
          }
          className={BTN_SM_PRIMARY}
        >
          {isRecognizing ? 'Распознаём...' : 'Распознать полис (PDF, DOC, DOCX)'}
        </button>
        <button
          type="button"
          onClick={() => handleDownloadDriveFiles()}
          disabled={
            isRecognizing ||
            isTrashing ||
            isDownloading ||
            !selectedDeal.driveFolderId ||
            selectedDriveFileIds.length === 0 ||
            !!driveError
          }
          className={BTN_SM_SECONDARY}
        >
          {isDownloading ? 'Скачиваю...' : 'Скачать'}
        </button>
        <button
          type="button"
          onClick={handleTrashSelectedFiles}
          disabled={
            isRecognizing ||
            isTrashing ||
            isDownloading ||
            !selectedDeal.driveFolderId ||
            selectedDriveFileIds.length === 0 ||
            !!driveError
          }
          className={BTN_SM_DANGER}
        >
          {isTrashing ? 'Удаляю...' : 'Удалить'}
        </button>
        <p className={SECTION_META_TEXT}>
          {selectedDriveFileIds.length
            ? `${selectedDriveFileIds.length} файл${selectedDriveFileIds.length === 1 ? '' : 'ов'} выбрано`
            : 'Выберите файлы для распознавания.'}
        </p>
      </div>

      {recognitionMessage && <p className={STATUS_BADGE_DANGER_XS}>{recognitionMessage}</p>}

      {trashMessage && <p className={STATUS_BADGE_DANGER_XS}>{trashMessage}</p>}

      {downloadMessage && <p className={STATUS_BADGE_DANGER_XS}>{downloadMessage}</p>}

      {renameMessage && <p className={STATUS_BADGE_DANGER_XS}>{renameMessage}</p>}

      <RecognitionResults results={recognitionResults} />

      {driveError && renderStatusMessage(driveError, 'danger')}

      {!driveError &&
        !selectedDeal.driveFolderId &&
        renderStatusMessage(
          'Папка Google Drive ещё не создана. Сначала сохраните сделку, чтобы получить папку.',
        )}

      <div className={CONTENT_SECTION_DIVIDER}>
        {!driveError &&
          selectedDeal.driveFolderId &&
          isDriveLoading &&
          renderStatusMessage('Загружаю файлы...')}

        {!driveError &&
          selectedDeal.driveFolderId &&
          !isDriveLoading &&
          sortedDriveFiles.length === 0 &&
          renderStatusMessage('Папка пуста.')}

        {!driveError && sortedDriveFiles.length > 0 && (
          <DriveFilesTable
            files={sortedDriveFiles}
            selectedFileIds={selectedDriveFileIds}
            onToggleSelection={toggleDriveFileSelection}
            isSelectionDisabled={() =>
              isDriveLoading || isTrashing || isDownloading || isRecognizing
            }
            expandedFolderIds={expandedFolderIds}
            onToggleFolder={toggleFolderExpanded}
            isFolderLoading={isFolderLoading}
            getRowDepth={(file) => getDriveFileDepth(file.id)}
            dateHeaderAriaSort={getAriaSort()}
            dateHeaderContent={
              <button
                type="button"
                onClick={toggleDriveSortDirection}
                aria-label={`Сортировать по дате, текущий порядок ${sortLabel}`}
                className={SORT_HEADER_BUTTON_CLASS}
              >
                <span className={SORT_HEADER_TITLE_CLASS}>Дата</span>
                <span className={SORT_HEADER_VALUE_CLASS}>{sortIndicator}</span>
              </button>
            }
            renderDate={(file) => formatDriveDate(file.modifiedAt ?? file.createdAt)}
            renderSize={(file) => formatDriveFileSize(file.size)}
            renderActions={(file) => (
              <div className="flex items-center justify-end gap-3">
                {file.webViewLink ? (
                  <a
                    href={file.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className={LINK_ACTION_XS}
                  >
                    Открыть
                  </a>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
                {isPreviewableFile(file) && (
                  <ActionLinkButton
                    onClick={() => handlePreviewFile(file)}
                    disabled={
                      isPreviewLoading ||
                      isDownloading ||
                      isTrashing ||
                      isDriveLoading ||
                      !!driveError
                    }
                  >
                    Просмотреть
                  </ActionLinkButton>
                )}
                <ActionLinkButton
                  onClick={() => handleDownloadDriveFiles([file.id])}
                  disabled={isDownloading || isTrashing || isDriveLoading || !!driveError}
                >
                  Скачать
                </ActionLinkButton>
                {!file.isFolder && (
                  <ActionLinkButton
                    onClick={() => openRenameModal(file)}
                    disabled={isRenameDisabled}
                  >
                    Переименовать
                  </ActionLinkButton>
                )}
                {!file.isFolder && (
                  <ActionLinkButton
                    onClick={() => handleTrashDriveFile(file)}
                    disabled={isDownloading || isTrashing || isDriveLoading || !!driveError}
                  >
                    Удалить
                  </ActionLinkButton>
                )}
              </div>
            )}
            emptyMessage="Папка пуста."
          />
        )}
      </div>
      {previewError && <InlineAlert as="p">{previewError}</InlineAlert>}
      {filePreview && (
        <Modal
          title="Просмотр файла"
          onClose={closeFilePreview}
          size="xl"
          panelClassName="max-h-[92vh] overflow-hidden"
          bodyClassName="max-h-[calc(92vh-72px)] overflow-y-auto"
        >
          <div className="space-y-3">
            <form
              className="space-y-1"
              onSubmit={(event) => {
                event.preventDefault();
                if (isPreviewRenameDisabled) {
                  return;
                }
                const formData = new FormData(event.currentTarget);
                const submittedDraft = String(formData.get('previewRenameDraft') ?? '');
                void handlePreviewRenameSubmit(submittedDraft);
              }}
            >
              <label
                htmlFor="deal-file-preview-rename"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-600"
              >
                Имя файла
              </label>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <div className={MODAL_INPUT_SHELL}>
                  <input
                    id="deal-file-preview-rename"
                    name="previewRenameDraft"
                    type="text"
                    value={previewRenameDraft}
                    onChange={(event) => setPreviewRenameDraft(event.target.value)}
                    disabled={isPreviewRenameDisabled}
                    className={PREVIEW_RENAME_INPUT_CLASS}
                  />
                  {previewRenameExtension && (
                    <span className="shrink-0 text-sm font-medium text-slate-500">
                      {previewRenameExtension}
                    </span>
                  )}
                </div>
                <button type="submit" disabled={isPreviewRenameDisabled} className={BTN_SM_PRIMARY}>
                  Переименовать
                </button>
                <button
                  type="button"
                  onClick={() => handleDownloadDriveFiles([filePreview.file.id])}
                  disabled={isDownloading || isTrashing || isDriveLoading || !!driveError}
                  className={BTN_SM_SECONDARY}
                >
                  {isDownloading ? 'Скачиваю...' : 'Скачать'}
                </button>
                {filePreview.file.webViewLink && (
                  <a
                    href={filePreview.file.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className={BTN_SM_SECONDARY}
                  >
                    Открыть в Google Drive
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => {
                    void handlePreviewDelete();
                  }}
                  disabled={isDownloading || isTrashing || isDriveLoading || !!driveError}
                  className={BTN_SM_DANGER}
                >
                  {isTrashing ? 'Удаляю...' : 'Удалить'}
                </button>
              </div>
              {previewRenameError && <InlineAlert as="p">{previewRenameError}</InlineAlert>}
            </form>
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={goToPrevFile}
                disabled={!canGoPrev || isPreviewLoading}
                className={BTN_SM_SECONDARY}
              >
                Назад
              </button>
              <p className="text-xs font-semibold text-slate-500">
                {currentPreviewIndex >= 0
                  ? `${currentPreviewIndex + 1} / ${previewableFiles.length}`
                  : '—'}
              </p>
              <button
                type="button"
                onClick={goToNextFile}
                disabled={!canGoNext || isPreviewLoading}
                className={BTN_SM_SECONDARY}
              >
                Вперёд
              </button>
            </div>
            <div className="min-h-[60vh] overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
              {filePreview.kind === 'image' && (
                <div className="flex min-h-[60vh] items-center justify-center p-3">
                  <img
                    src={filePreview.src}
                    alt={filePreview.file.name}
                    className="max-h-[70vh] max-w-full h-auto w-auto"
                  />
                </div>
              )}
              {filePreview.kind === 'pdf' && (
                <iframe
                  src={filePreview.src}
                  title={`Просмотр файла ${filePreview.file.name}`}
                  className="h-[70vh] w-full bg-white"
                />
              )}
              {filePreview.kind === 'drive' && (
                <div className="space-y-2">
                  <iframe
                    src={filePreview.src}
                    title={`Просмотр файла ${filePreview.file.name}`}
                    className="h-[70vh] w-full bg-white"
                    allow="autoplay"
                  />
                  <p className="px-3 pb-3 text-xs text-slate-500">
                    Если документ не открылся во встроенном просмотре, откройте его в Google Drive
                    или скачайте файл.
                  </p>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
      {renamingFile && (
        <Modal
          title="Переименовать файл"
          onClose={closeRenameModal}
          size="sm"
          zIndex={50}
          closeOnOverlayClick={false}
        >
          <div className="space-y-4">
            {renameError && <InlineAlert as="p">{renameError}</InlineAlert>}
            <div>
              <label className="block text-sm font-semibold text-slate-700">Новое имя</label>
              <div className={MODAL_INPUT_SHELL}>
                <input
                  type="text"
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  className={RENAME_INPUT_CLASS}
                />
                {renameExtension && (
                  <span className="shrink-0 text-sm font-medium text-slate-500">
                    {renameExtension}
                  </span>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <button
                type="button"
                onClick={handleRenameSubmit}
                disabled={isRenaming}
                className={BTN_BLOCK_PRIMARY}
              >
                {isRenaming ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button type="button" onClick={closeRenameModal} className={BTN_BLOCK_SECONDARY}>
                Отмена
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
