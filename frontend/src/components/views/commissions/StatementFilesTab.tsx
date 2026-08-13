import React from 'react';

import type { DriveFile, Statement } from '../../../types';
import { FileUploadManager } from '../../FileUploadManager';
import { Button } from '../../common/Button';
import { InlineAlert } from '../../common/InlineAlert';
import { DriveFilesTable } from '../../common/table/DriveFilesTable';
import { formatDriveDate, formatDriveFileSize } from '../dealsView/helpers';

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
                className={'link-action text-xs'}
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
          <Button
            type="button"
            onClick={onRefresh}
            disabled={isStatementDriveLoading}
            variant="secondary"
            size="sm"
          >
            {isStatementDriveLoading ? 'Обновляю...' : 'Обновить'}
          </Button>
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
        <Button
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
          variant="secondary"
          size="sm"
        >
          {isStatementDriveDownloading ? 'Скачиваю...' : 'Скачать'}
        </Button>
        <Button
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
          variant="danger"
          size="sm"
        >
          {isStatementDriveTrashing ? 'Удаляю...' : 'Удалить'}
        </Button>
        <p className="text-xs text-slate-500">
          {selectedStatementDriveFileIds.length
            ? `${selectedStatementDriveFileIds.length} файл${selectedStatementDriveFileIds.length === 1 ? '' : 'ов'} выбрано`
            : 'Выберите файлы для действий.'}
        </p>
      </div>

      {statementDriveError && <InlineAlert as="p">{statementDriveError}</InlineAlert>}

      {statementDriveTrashMessage && (
        <p className={'ui-status-danger-badge-xs'}>{statementDriveTrashMessage}</p>
      )}

      {statementDriveDownloadMessage && (
        <p className={'ui-status-danger-badge-xs'}>{statementDriveDownloadMessage}</p>
      )}

      {!statementDriveError &&
        hasStatementDriveFolder &&
        !isStatementDriveLoading &&
        sortedStatementDriveFiles.length === 0 && (
          <div className={'ui-panel-muted-text'}>Папка пуста.</div>
        )}

      {!statementDriveError && sortedStatementDriveFiles.length > 0 && (
        <DriveFilesTable
          files={sortedStatementDriveFiles}
          selectedFileIds={selectedStatementDriveFileIds}
          onToggleSelection={onToggleSelection}
          isSelectionDisabled={(file) =>
            file.isFolder ||
            isStatementDriveLoading ||
            isStatementDriveTrashing ||
            isStatementDriveDownloading
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
              <Button
                type="button"
                onClick={() => onDownloadFile(file.id)}
                disabled={
                  file.isFolder ||
                  isStatementDriveDownloading ||
                  isStatementDriveTrashing ||
                  isStatementDriveLoading ||
                  !!statementDriveError
                }
                className={`${'link-action text-xs'} disabled:text-slate-300`}
              >
                Скачать
              </Button>
              <Button
                type="button"
                onClick={() => onDeleteFile(file)}
                disabled={
                  file.isFolder ||
                  isStatementDriveDownloading ||
                  isStatementDriveTrashing ||
                  isStatementDriveLoading ||
                  !!statementDriveError
                }
                className={`${'link-action text-xs'} disabled:text-slate-300`}
              >
                Удалить
              </Button>
            </div>
          )}
          emptyMessage="Папка пуста."
        />
      )}
    </section>
  );
};
