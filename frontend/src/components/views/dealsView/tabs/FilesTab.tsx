import React from 'react';
import type { Deal, DriveFile, PolicyRecognitionResult } from '../../../../types';
import { FileUploadManager } from '../../../FileUploadManager';
import {
  formatDriveDate,
  formatDriveFileSize,
  formatRecognitionSummary,
  getDriveItemIcon,
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
  isRecognizing: boolean;
  recognitionResults: PolicyRecognitionResult[];
  recognitionMessage: string | null;
  isTrashing: boolean;
  trashMessage: string | null;
  handleTrashSelectedFiles: () => Promise<void>;
  driveError: string | null;
  sortedDriveFiles: DriveFile[];
  canRecognizeSelectedFiles: boolean;
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
  isRecognizing,
  recognitionResults,
  recognitionMessage,
  isTrashing,
  trashMessage,
  handleTrashSelectedFiles,
  driveError,
  canRecognizeSelectedFiles,
  sortedDriveFiles,
}) => {
  if (!selectedDeal) {
    return null;
  }

  const renderStatusMessage = (message: string, tone: 'default' | 'danger' = 'default') => {
    const className =
      tone === 'danger'
        ? 'rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700'
        : 'app-panel-muted px-4 py-3 text-sm text-slate-600';

    return <div className={className}>{message}</div>;
  };

  const disableUpload = !selectedDeal.driveFolderId;
  const driveFolderLink = selectedDeal.driveFolderId
    ? `https://drive.google.com/drive/folders/${selectedDeal.driveFolderId}`
    : null;

  return (
    <section className="app-panel p-6 shadow-none space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="app-label">Файлы</p>
            {driveFolderLink && (
              <a
                href={driveFolderLink}
                target="_blank"
                rel="noreferrer"
                className="link-action text-xs"
              >
                Открыть папку Google Drive
              </a>
            )}
          </div>
          <p className="text-xs text-slate-500">Контент читается прямо из папки, привязанной к этой сделке.</p>
        </div>
        <button
          type="button"
          onClick={loadDriveFiles}
          disabled={!selectedDeal.driveFolderId || isDriveLoading}
          className="btn btn-secondary btn-sm rounded-xl"
        >
          {isDriveLoading ? 'Обновляю...' : 'Обновить'}
        </button>
      </div>

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
            !selectedDeal.driveFolderId ||
            selectedDriveFileIds.length === 0 ||
            !canRecognizeSelectedFiles ||
            !!driveError
          }
          className="btn btn-primary btn-sm rounded-xl"
        >
          {isRecognizing ? 'Распознаем...' : 'Распознать полис (только PDF)'}
        </button>
        <button
          type="button"
          onClick={handleTrashSelectedFiles}
          disabled={
            isRecognizing ||
            isTrashing ||
            !selectedDeal.driveFolderId ||
            selectedDriveFileIds.length === 0 ||
            !!driveError
          }
          className="btn btn-danger btn-sm rounded-xl"
        >
          {isTrashing ? 'Удаляю...' : 'Удалить'}
        </button>
        <p className="text-xs text-slate-500">
          {selectedDriveFileIds.length ? (
            canRecognizeSelectedFiles ? (
              `${selectedDriveFileIds.length} файл${selectedDriveFileIds.length === 1 ? '' : 'ов'} выбрано`
            ) : (
              'Можно распознавать только PDF-файлы'
            )
          ) : (
            'Выберите файлы для распознавания'
          )}
        </p>
      </div>

      {recognitionMessage && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">{recognitionMessage}</p>
      )}

      {trashMessage && <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">{trashMessage}</p>}

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
                  <pre className="whitespace-pre-wrap text-[11px] leading-snug">{result.transcript}</pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}

      {driveError && renderStatusMessage(driveError, 'danger')}

      {!driveError && !selectedDeal.driveFolderId && (
        renderStatusMessage('Папка Google Drive ещё не создана. Сначала сохраните сделку, чтобы получить папку.')
      )}

      <div className="space-y-3 border-t border-slate-100 pt-4">
        {!driveError && selectedDeal.driveFolderId && isDriveLoading && (
          renderStatusMessage('Загружаю файлы...')
        )}

        {!driveError && selectedDeal.driveFolderId && !isDriveLoading && sortedDriveFiles.length === 0 && (
          renderStatusMessage('Папка пуста.')
        )}

        {!driveError && sortedDriveFiles.length > 0 && (
          <div className="space-y-2">
            {sortedDriveFiles.map((file) => {
              const isSelected = selectedDriveFileIds.includes(file.id);
              const canSelect = !file.isFolder && !isDriveLoading && !isTrashing;
              return (
                <div
                  key={file.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!canSelect}
                      onChange={() => toggleDriveFileSelection(file.id)}
                      className="h-4 w-4 rounded-sm border border-slate-300 text-sky-600 focus:ring-0"
                    />
                    <span className="text-xl">{getDriveItemIcon(file.isFolder)}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 break-all">{file.name}</p>
                      <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                        <span>{formatDriveFileSize(file.size)}</span>
                        <span>{formatDriveDate(file.modifiedAt ?? file.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  {file.webViewLink ? (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="link-action text-xs"
                    >
                      Открыть
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
