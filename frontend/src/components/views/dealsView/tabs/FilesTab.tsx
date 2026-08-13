import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DriveFile } from '../../../../types';
import { buildDriveFolderLink } from '../../../../utils/links';
import { Button } from '../../../common/Button';
import { DriveFilesTable } from '../../../common/table/DriveFilesTable';
import { InlineAlert } from '../../../common/InlineAlert';
import { formatDriveDate, formatDriveFileSize } from '../helpers';
import {
  ActionLinkButton,
  SORT_HEADER_BUTTON_CLASS,
  SORT_HEADER_TITLE_CLASS,
  SORT_HEADER_VALUE_CLASS,
} from './FilesTabParts';
import { FilePreviewDialogs, type FilePreviewState } from './FilePreviewDialogs';
import { FilesTabToolbar } from './FilesTabToolbar';
import type { FilesTabProps } from './filesTabTypes';
import { getFilePreviewKind, isImageFile, splitFileName } from './filePreviewUtils';

function FilesTabContent({
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
  const [renamingFile, setRenamingFile] = useState<DriveFile | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [filePreview, setFilePreview] = useState<FilePreviewState | null>(null);
  const [previewRenameDraft, setPreviewRenameDraft] = useState('');
  const [previewRenameError, setPreviewRenameError] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const filePreviewSrcRef = useRef<string | null>(null);

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

  const isPreviewableFile = useCallback((file: DriveFile) => getFilePreviewKind(file) !== null, []);

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
    [getDriveFileBlob, previewableFiles],
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
    [filePreview, handleRenameDriveFile, previewRenameDraft],
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
    if (!filePreview || filePreview.kind !== 'image') {
      return;
    }

    let cancelled = false;
    const imageFilesToPreload = previewableFiles.filter(
      (file) => file.id !== filePreview.file.id && isImageFile(file),
    );

    const preloadImages = async () => {
      for (const file of imageFilesToPreload) {
        if (cancelled) {
          return;
        }
        try {
          await getDriveFileBlob(file.id);
        } catch {
          // Фоновая предзагрузка не должна мешать ручному просмотру файла.
        }
      }
    };

    void preloadImages();
    return () => {
      cancelled = true;
    };
  }, [filePreview, getDriveFileBlob, previewableFiles]);

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
  }, [filePreview]);

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
    <section className={`${'ui-panel-section'} space-y-5`}>
      <FilesTabToolbar
        selectedDeal={selectedDeal}
        driveFolderLink={driveFolderLink}
        mailboxEmail={mailboxEmail}
        isDriveLoading={isDriveLoading}
        loadDriveFiles={loadDriveFiles}
        onUploadDriveFile={onUploadDriveFile}
        isSelectedDealDeleted={isSelectedDealDeleted}
        selectedDriveFileIds={selectedDriveFileIds}
        handleRecognizePolicies={handleRecognizePolicies}
        isRecognizing={isRecognizing}
        canRecognizeSelectedFiles={canRecognizeSelectedFiles}
        handleTrashSelectedFiles={handleTrashSelectedFiles}
        isTrashing={isTrashing}
        handleDownloadDriveFiles={handleDownloadDriveFiles}
        isDownloading={isDownloading}
        driveError={driveError}
        recognitionMessage={recognitionMessage}
        trashMessage={trashMessage}
        downloadMessage={downloadMessage}
        renameMessage={renameMessage}
        recognitionResults={recognitionResults}
        isCreatingMailbox={isCreatingMailbox}
        isCheckingMailbox={isCheckingMailbox}
        mailboxActionError={mailboxActionError}
        mailboxActionSuccess={mailboxActionSuccess}
        onCreateMailbox={onCreateMailbox}
        onCheckMailbox={onCheckMailbox}
      />

      <div className={'ui-content-divider'}>
        {!driveError && selectedDeal.driveFolderId && isDriveLoading && (
          <div className="ui-panel-muted-text">Загружаю файлы...</div>
        )}

        {!driveError &&
          selectedDeal.driveFolderId &&
          !isDriveLoading &&
          sortedDriveFiles.length === 0 && <div className="ui-panel-muted-text">Папка пуста.</div>}

        {!driveError && sortedDriveFiles.length > 0 && (
          <DriveFilesTable
            files={sortedDriveFiles}
            selectedFileIds={selectedDriveFileIds}
            onToggleSelection={toggleDriveFileSelection}
            isSelectionDisabled={() =>
              isDriveLoading || isTrashing || isDownloading || isRecognizing
            }
            isFolderRowSelectable
            expandedFolderIds={expandedFolderIds}
            onToggleFolder={toggleFolderExpanded}
            isFolderLoading={isFolderLoading}
            getRowDepth={(file) => getDriveFileDepth(file.id)}
            dateHeaderAriaSort={getAriaSort()}
            dateHeaderContent={
              <Button
                type="button"
                onClick={toggleDriveSortDirection}
                aria-label={`Сортировать по дате, текущий порядок ${sortLabel}`}
                className={SORT_HEADER_BUTTON_CLASS}
              >
                <span className={SORT_HEADER_TITLE_CLASS}>Дата</span>
                <span className={SORT_HEADER_VALUE_CLASS}>{sortIndicator}</span>
              </Button>
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
                    className={'link-action text-xs'}
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
                <ActionLinkButton
                  onClick={() => handleTrashDriveFile(file)}
                  disabled={isDownloading || isTrashing || isDriveLoading || !!driveError}
                >
                  Удалить
                </ActionLinkButton>
              </div>
            )}
            emptyMessage="Папка пуста."
          />
        )}
      </div>
      {previewError && <InlineAlert as="p">{previewError}</InlineAlert>}
      <FilePreviewDialogs
        filePreview={filePreview}
        closeFilePreview={closeFilePreview}
        previewRenameDraft={previewRenameDraft}
        setPreviewRenameDraft={setPreviewRenameDraft}
        previewRenameExtension={previewRenameExtension}
        previewRenameError={previewRenameError}
        isPreviewRenameDisabled={isPreviewRenameDisabled}
        handlePreviewRenameSubmit={handlePreviewRenameSubmit}
        handleDownloadDriveFiles={handleDownloadDriveFiles}
        handlePreviewDelete={handlePreviewDelete}
        isDownloading={isDownloading}
        isTrashing={isTrashing}
        isDriveLoading={isDriveLoading}
        driveError={driveError}
        canGoPrev={canGoPrev}
        canGoNext={canGoNext}
        isPreviewLoading={isPreviewLoading}
        goToPrevFile={goToPrevFile}
        goToNextFile={goToNextFile}
        currentPreviewIndex={currentPreviewIndex}
        previewableFilesCount={previewableFiles.length}
        renamingFile={renamingFile}
        closeRenameModal={closeRenameModal}
        renameError={renameError}
        renameDraft={renameDraft}
        setRenameDraft={setRenameDraft}
        renameExtension={renameExtension}
        handleRenameSubmit={handleRenameSubmit}
        isRenaming={isRenaming}
      />
    </section>
  );
}

export function FilesTab(props: FilesTabProps) {
  return <FilesTabContent {...props} />;
}
