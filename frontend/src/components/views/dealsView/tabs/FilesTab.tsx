import React, { useState } from 'react';
import type {
  Deal,
  DocumentRecognitionResult,
  DriveFile,
  PolicyRecognitionResult,
} from '../../../../types';
import { FileUploadManager } from '../../../FileUploadManager';
import { buildDriveFolderLink } from '../../../../utils/links';
import { copyToClipboard } from '../../../../utils/clipboard';
import { useNotification } from '../../../../contexts/NotificationContext';
import {
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SM_DANGER,
  BTN_SM_PRIMARY,
  BTN_SM_SECONDARY,
} from '../../../common/buttonStyles';
import { DriveFilesTable } from '../../../common/table/DriveFilesTable';
import {
  LINK_ACTION_XS,
  PANEL_MUTED_TEXT,
  STATUS_BADGE_DANGER_XS,
} from '../../../common/uiClassNames';
import { InlineAlert } from '../../../common/InlineAlert';
import { Modal } from '../../../Modal';
import {
  formatDocumentRecognitionSummary,
  formatDriveDate,
  formatDriveFileSize,
  formatRecognitionSummary,
} from '../helpers';

interface FilesTabProps {
  selectedDeal: Deal | null;
  isDriveLoading: boolean;
  loadDriveFiles: () => Promise<void>;
  onUploadDriveFile: (file: File) => Promise<void>;
  isSelectedDealDeleted: boolean;
  selectedDriveFileIds: string[];
  toggleDriveFileSelection: (fileId: string) => void;
  handleRecognizePolicies: () => Promise<void>;
  handleRecognizeDocuments: () => Promise<void>;
  isRecognizing: boolean;
  recognitionResults: PolicyRecognitionResult[];
  recognitionMessage: string | null;
  isDocumentRecognizing: boolean;
  documentRecognitionResults: DocumentRecognitionResult[];
  documentRecognitionMessage: string | null;
  isTrashing: boolean;
  trashMessage: string | null;
  handleTrashSelectedFiles: () => Promise<void>;
  isDownloading: boolean;
  downloadMessage: string | null;
  handleDownloadDriveFiles: (fileIds?: string[]) => Promise<void>;
  driveError: string | null;
  sortedDriveFiles: DriveFile[];
  canRecognizeSelectedFiles: boolean;
  canRecognizeSelectedDocumentFiles: boolean;
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

export const FilesTab: React.FC<FilesTabProps> = ({
  selectedDeal,
  isDriveLoading,
  loadDriveFiles,
  onUploadDriveFile,
  isSelectedDealDeleted,
  selectedDriveFileIds,
  toggleDriveFileSelection,
  handleRecognizePolicies,
  handleRecognizeDocuments,
  isRecognizing,
  recognitionResults,
  recognitionMessage,
  isDocumentRecognizing,
  documentRecognitionResults,
  documentRecognitionMessage,
  isTrashing,
  trashMessage,
  handleTrashSelectedFiles,
  isDownloading,
  downloadMessage,
  handleDownloadDriveFiles,
  driveError,
  canRecognizeSelectedFiles,
  canRecognizeSelectedDocumentFiles,
  sortedDriveFiles,
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
}) => {
  const { addNotification } = useNotification();
  const [renamingFile, setRenamingFile] = useState<DriveFile | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);

  const splitFileName = (name: string): { baseName: string; extension: string } => {
    const lastDotIndex = name.lastIndexOf('.');
    if (lastDotIndex <= 0 || lastDotIndex === name.length - 1) {
      return { baseName: name, extension: '' };
    }

    return {
      baseName: name.slice(0, lastDotIndex),
      extension: name.slice(lastDotIndex),
    };
  };

  if (!selectedDeal) {
    return null;
  }

  const renderStatusMessage = (message: string, tone: 'default' | 'danger' = 'default') => {
    if (tone === 'danger') {
      return <InlineAlert>{message}</InlineAlert>;
    }
    return <div className={PANEL_MUTED_TEXT}>{message}</div>;
  };

  const disableUpload = !selectedDeal.driveFolderId;
  const driveFolderLink = buildDriveFolderLink(selectedDeal.driveFolderId);
  const mailboxEmail = (selectedDeal.mailboxEmail ?? '').trim();
  const getSortIndicator = () => (driveSortDirection === 'asc' ? '↑' : '↓');
  const getSortLabel = () => (driveSortDirection === 'asc' ? 'по возрастанию' : 'по убыванию');
  const getColumnTitleClass = () => {
    const baseClass = 'text-[11px] font-semibold uppercase tracking-wide';
    return `${baseClass} text-rose-600 underline decoration-rose-500 decoration-2 underline-offset-2`;
  };
  const getAriaSort = (): 'ascending' | 'descending' =>
    driveSortDirection === 'asc' ? 'ascending' : 'descending';
  const isRenameDisabled =
    isRenaming ||
    isDriveLoading ||
    isTrashing ||
    isDownloading ||
    isSelectedDealDeleted ||
    !selectedDeal.driveFolderId;

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
    <section className="app-panel p-6 shadow-none space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="app-label">Файлы</p>
            {isDriveLoading && (
              <span
                className="inline-block h-4 w-4 rounded-full border-2 border-slate-300 border-t-sky-600 animate-spin"
                aria-label="Идет загрузка файлов"
              />
            )}
            {driveFolderLink && (
              <a href={driveFolderLink} target="_blank" rel="noreferrer" className={LINK_ACTION_XS}>
                Открыть папку в Google Drive
              </a>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Файлы загружаются прямо из папки, привязанной к этой сделке.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!selectedDeal.mailboxEmail && (
            <button
              type="button"
              onClick={() => {
                void onCreateMailbox();
              }}
              disabled={isCreatingMailbox || isCheckingMailbox}
              className={BTN_SM_PRIMARY}
            >
              {isCreatingMailbox ? 'Создаю ящик...' : 'Создать почту сделки'}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void onCheckMailbox();
            }}
            disabled={!selectedDeal.mailboxEmail || isCheckingMailbox || isCreatingMailbox}
            className={BTN_SM_SECONDARY}
          >
            {isCheckingMailbox ? 'Проверяем почту...' : 'Проверить почту'}
          </button>
          <button
            type="button"
            onClick={loadDriveFiles}
            disabled={!selectedDeal.driveFolderId || isDriveLoading}
            className={BTN_SM_SECONDARY}
          >
            {isDriveLoading ? 'Обновляю...' : 'Обновить'}
          </button>
        </div>
      </div>
      {mailboxEmail && (
        <p className="text-xs text-slate-500">
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
          onClick={handleRecognizeDocuments}
          disabled={
            isDocumentRecognizing ||
            isRecognizing ||
            isTrashing ||
            isDownloading ||
            !selectedDeal.driveFolderId ||
            selectedDriveFileIds.length === 0 ||
            !canRecognizeSelectedDocumentFiles ||
            !!driveError
          }
          className={BTN_SM_PRIMARY}
        >
          {isDocumentRecognizing ? 'Распознаём...' : 'Распознать документы'}
        </button>
        <button
          type="button"
          onClick={handleRecognizePolicies}
          disabled={
            isRecognizing ||
            isDocumentRecognizing ||
            isTrashing ||
            isDownloading ||
            !selectedDeal.driveFolderId ||
            selectedDriveFileIds.length === 0 ||
            !canRecognizeSelectedFiles ||
            !!driveError
          }
          className={BTN_SM_PRIMARY}
        >
          {isRecognizing ? 'Распознаём...' : 'Распознать полис (только PDF)'}
        </button>
        <button
          type="button"
          onClick={() => handleDownloadDriveFiles()}
          disabled={
            isRecognizing ||
            isDocumentRecognizing ||
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
            isDocumentRecognizing ||
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
        <p className="text-xs text-slate-500">
          {selectedDriveFileIds.length
            ? `${selectedDriveFileIds.length} файл${selectedDriveFileIds.length === 1 ? '' : 'ов'} выбрано`
            : 'Выберите файлы для распознавания.'}
        </p>
      </div>

      {recognitionMessage && <p className={STATUS_BADGE_DANGER_XS}>{recognitionMessage}</p>}
      {documentRecognitionMessage && (
        <p className={STATUS_BADGE_DANGER_XS}>{documentRecognitionMessage}</p>
      )}

      {trashMessage && <p className={STATUS_BADGE_DANGER_XS}>{trashMessage}</p>}

      {downloadMessage && <p className={STATUS_BADGE_DANGER_XS}>{downloadMessage}</p>}

      {renameMessage && <p className={STATUS_BADGE_DANGER_XS}>{renameMessage}</p>}

      {recognitionResults.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3 text-xs">
          {recognitionResults.map((result) => (
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
      )}

      {documentRecognitionResults.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-3 text-xs">
          {documentRecognitionResults.map((result) => (
            <div key={`${result.fileId}-${result.status}`} className="space-y-1">
              <p className="font-semibold text-slate-900">{result.fileName ?? result.fileId}</p>
              <p
                className={`text-[11px] ${
                  result.status === 'error' ? 'text-rose-600' : 'text-slate-500'
                }`}
              >
                {formatDocumentRecognitionSummary(result)}
              </p>
              {result.doc?.normalizedType && (
                <p className="text-[11px] text-slate-500">
                  Категория CRM: <span className="font-medium">{result.doc.normalizedType}</span>
                </p>
              )}
              {result.doc?.warnings && result.doc.warnings.length > 0 && (
                <p className="text-[11px] text-amber-700">
                  Предупреждения: {result.doc.warnings.join(', ')}
                </p>
              )}
              {result.error?.message && result.status === 'error' && (
                <p className="text-[11px] text-rose-600">Ошибка: {result.error.message}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {driveError && renderStatusMessage(driveError, 'danger')}

      {!driveError &&
        !selectedDeal.driveFolderId &&
        renderStatusMessage(
          'Папка Google Drive ещё не создана. Сначала сохраните сделку, чтобы получить папку.',
        )}

      <div className="space-y-3 border-t border-slate-100 pt-4">
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
              isDriveLoading ||
              isTrashing ||
              isDownloading ||
              isRecognizing ||
              isDocumentRecognizing
            }
            dateHeaderAriaSort={getAriaSort()}
            dateHeaderContent={
              <button
                type="button"
                onClick={toggleDriveSortDirection}
                aria-label={`Сортировать по дате, текущий порядок ${getSortLabel()}`}
                className="flex w-full items-center justify-end gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <span className={getColumnTitleClass()}>Дата</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-900">
                  {getSortIndicator()}
                </span>
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
                <button
                  type="button"
                  onClick={() => handleDownloadDriveFiles([file.id])}
                  disabled={isDownloading || isTrashing || isDriveLoading || !!driveError}
                  className={`${LINK_ACTION_XS} disabled:text-slate-300`}
                >
                  Скачать
                </button>
                {!file.isFolder && (
                  <button
                    type="button"
                    onClick={() => openRenameModal(file)}
                    disabled={isRenameDisabled}
                    className={`${LINK_ACTION_XS} disabled:text-slate-300`}
                  >
                    Переименовать
                  </button>
                )}
              </div>
            )}
            emptyMessage="Папка пуста."
          />
        )}
      </div>
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
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
                <input
                  type="text"
                  value={renameDraft}
                  onChange={(event) => setRenameDraft(event.target.value)}
                  className="min-w-0 flex-1 border-none bg-transparent p-0 text-sm text-slate-700 outline-none"
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
                className={`${BTN_PRIMARY} w-full rounded-xl`}
              >
                {isRenaming ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button
                type="button"
                onClick={closeRenameModal}
                className={`${BTN_SECONDARY} w-full`}
              >
                Отмена
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
};
