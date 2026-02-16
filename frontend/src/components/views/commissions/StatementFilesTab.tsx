import React from 'react';

import type { DriveFile, Statement } from '../../../types';
import { FileUploadManager } from '../../FileUploadManager';
import { TableHeadCell } from '../../common/TableHeadCell';
import {
  TABLE_CELL_CLASS_SM,
  TABLE_ROW_CLASS_PLAIN,
  TABLE_THEAD_CLASS,
} from '../../common/tableStyles';
import { formatDriveDate, formatDriveFileSize, getDriveItemIcon } from '../dealsView/helpers';

interface StatementFilesTabProps {
  selectedStatement?: Statement;
  statementDriveFolderLink: string | null;
  isStatementDriveLoading: boolean;
  isStatementDriveUploading: boolean;
  isStatementDriveTrashing: boolean;
  isStatementDriveDownloading: boolean;
  selectedStatementDriveFileIds: string[];
  statementDriveError: string | null;
  statementDriveTrashMessage: string | null;
  statementDriveDownloadMessage: string | null;
  hasStatementDriveFolder: boolean;
  sortedStatementDriveFiles: DriveFile[];
  onRefresh: () => void;
  onUpload: (file: File) => Promise<void>;
  onDownloadSelected: () => void;
  onTrashSelected: () => void;
  onToggleSelection: (fileId: string) => void;
  onDownloadFile: (fileId: string) => void;
  onDeleteFile: (file: DriveFile) => void;
}

export const StatementFilesTab: React.FC<StatementFilesTabProps> = ({
  selectedStatement,
  statementDriveFolderLink,
  isStatementDriveLoading,
  isStatementDriveUploading,
  isStatementDriveTrashing,
  isStatementDriveDownloading,
  selectedStatementDriveFileIds,
  statementDriveError,
  statementDriveTrashMessage,
  statementDriveDownloadMessage,
  hasStatementDriveFolder,
  sortedStatementDriveFiles,
  onRefresh,
  onUpload,
  onDownloadSelected,
  onTrashSelected,
  onToggleSelection,
  onDownloadFile,
  onDeleteFile,
}) => {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="app-label">Файлы</p>
            {statementDriveFolderLink && (
              <a
                href={statementDriveFolderLink}
                target="_blank"
                rel="noreferrer"
                className="link-action text-xs"
              >
                Открыть папку в Google Drive
              </a>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Файлы загружаются прямо из папки, привязанной к этой ведомости.
          </p>
        </div>
        {selectedStatement && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isStatementDriveLoading}
            className="btn btn-secondary btn-sm rounded-xl"
          >
            {isStatementDriveLoading ? 'Обновляю...' : 'Обновить'}
          </button>
        )}
      </div>

      <FileUploadManager
        onUpload={onUpload}
        disabled={
          !selectedStatement ||
          isStatementDriveUploading ||
          isStatementDriveLoading ||
          isStatementDriveTrashing ||
          isStatementDriveDownloading
        }
      />

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <button
          type="button"
          onClick={onDownloadSelected}
          disabled={
            isStatementDriveDownloading ||
            isStatementDriveTrashing ||
            isStatementDriveLoading ||
            !selectedStatement ||
            selectedStatementDriveFileIds.length === 0 ||
            !!statementDriveError
          }
          className="btn btn-secondary btn-sm rounded-xl"
        >
          {isStatementDriveDownloading ? 'Скачиваю...' : 'Скачать'}
        </button>
        <button
          type="button"
          onClick={onTrashSelected}
          disabled={
            isStatementDriveDownloading ||
            isStatementDriveTrashing ||
            isStatementDriveLoading ||
            !selectedStatement ||
            selectedStatementDriveFileIds.length === 0 ||
            !!statementDriveError
          }
          className="btn btn-danger btn-sm rounded-xl"
        >
          {isStatementDriveTrashing ? 'Удаляю...' : 'Удалить'}
        </button>
        <p className="text-xs text-slate-500">
          {selectedStatementDriveFileIds.length
            ? `${selectedStatementDriveFileIds.length} файл${selectedStatementDriveFileIds.length === 1 ? '' : 'ов'} выбрано`
            : 'Выберите файлы для действий.'}
        </p>
      </div>

      {statementDriveError && <p className="app-alert app-alert-danger">{statementDriveError}</p>}

      {statementDriveTrashMessage && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">
          {statementDriveTrashMessage}
        </p>
      )}

      {statementDriveDownloadMessage && (
        <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">
          {statementDriveDownloadMessage}
        </p>
      )}

      {!statementDriveError &&
        hasStatementDriveFolder &&
        !isStatementDriveLoading &&
        sortedStatementDriveFiles.length === 0 && (
          <div className="app-panel-muted px-4 py-3 text-sm text-slate-600">Папка пуста.</div>
        )}

      {!statementDriveError && sortedStatementDriveFiles.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className={TABLE_THEAD_CLASS}>
                <tr>
                  <TableHeadCell padding="sm" className="w-10">
                    <span className="sr-only">Выбор</span>
                  </TableHeadCell>
                  <TableHeadCell padding="sm">Файл</TableHeadCell>
                  <TableHeadCell padding="sm" align="right">
                    Размер
                  </TableHeadCell>
                  <TableHeadCell padding="sm" align="right">
                    Дата
                  </TableHeadCell>
                  <TableHeadCell padding="sm" align="right">
                    Действия
                  </TableHeadCell>
                </tr>
              </thead>
              <tbody>
                {sortedStatementDriveFiles.map((file) => {
                  const isSelected = selectedStatementDriveFileIds.includes(file.id);
                  const canSelect =
                    !file.isFolder &&
                    !isStatementDriveLoading &&
                    !isStatementDriveTrashing &&
                    !isStatementDriveDownloading;

                  return (
                    <tr key={file.id} className={TABLE_ROW_CLASS_PLAIN}>
                      <td className={TABLE_CELL_CLASS_SM}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canSelect}
                          onChange={() => onToggleSelection(file.id)}
                          className="check rounded-sm"
                          aria-label={`Выбрать файл: ${file.name}`}
                        />
                      </td>
                      <td className={TABLE_CELL_CLASS_SM}>
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg">{getDriveItemIcon(file.isFolder)}</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 break-all">
                              {file.name}
                            </p>
                            <p className="text-xs text-slate-500">{file.mimeType || '—'}</p>
                          </div>
                        </div>
                      </td>
                      <td className={`${TABLE_CELL_CLASS_SM} text-right text-xs text-slate-500`}>
                        {formatDriveFileSize(file.size)}
                      </td>
                      <td className={`${TABLE_CELL_CLASS_SM} text-right text-xs text-slate-500`}>
                        {formatDriveDate(file.modifiedAt ?? file.createdAt)}
                      </td>
                      <td className={`${TABLE_CELL_CLASS_SM} text-right`}>
                        <div className="flex items-center justify-end gap-3">
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
                          <button
                            type="button"
                            onClick={() => onDownloadFile(file.id)}
                            disabled={
                              file.isFolder ||
                              isStatementDriveDownloading ||
                              isStatementDriveTrashing ||
                              isStatementDriveLoading ||
                              !!statementDriveError
                            }
                            className="link-action text-xs disabled:text-slate-300"
                          >
                            Скачать
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteFile(file)}
                            disabled={
                              file.isFolder ||
                              isStatementDriveDownloading ||
                              isStatementDriveTrashing ||
                              isStatementDriveLoading ||
                              !!statementDriveError
                            }
                            className="link-action text-xs disabled:text-slate-300"
                          >
                            Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
