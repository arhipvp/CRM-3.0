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
  driveError,
  canRecognizeSelectedFiles,
  sortedDriveFiles,
}) => {
  if (!selectedDeal) {
    return null;
  }

  const disableUpload = !selectedDeal.driveFolderId;

  return (
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-900">Файлы Google Drive</p>
          <p className="text-xs text-slate-500">Контент читается прямо из папки, привязанной к этой сделке.</p>
        </div>
        <button
          type="button"
          onClick={loadDriveFiles}
          disabled={!selectedDeal.driveFolderId || isDriveLoading}
          className="self-start rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-500 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
            !selectedDeal.driveFolderId ||
            selectedDriveFileIds.length === 0 ||
            !canRecognizeSelectedFiles ||
            !!driveError
          }
          className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {isRecognizing ? 'Распознаем...' : 'Распознать полис (только PDF)'}
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

      {driveError && (
        <p className="text-xs text-rose-500 bg-rose-50 p-3 rounded-lg">{driveError}</p>
      )}

      {!driveError && !selectedDeal.driveFolderId && (
        <p className="text-xs text-slate-500">
          Папка Google Drive ещё не создана. Сначала сохраните сделку, чтобы получить папку.
        </p>
      )}

      <div className="space-y-3 border-t border-slate-100 pt-4">
        {!driveError && selectedDeal.driveFolderId && isDriveLoading && (
          <p className="text-sm text-slate-500">Загружаю файлы...</p>
        )}

        {!driveError && selectedDeal.driveFolderId && !isDriveLoading && sortedDriveFiles.length === 0 && (
          <p className="text-sm text-slate-500">Папка пуста.</p>
        )}

        {!driveError && sortedDriveFiles.length > 0 && (
          <div className="space-y-2">
            {sortedDriveFiles.map((file) => {
              const isSelected = selectedDriveFileIds.includes(file.id);
              const canSelect = !file.isFolder && !isDriveLoading;
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
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800"
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
