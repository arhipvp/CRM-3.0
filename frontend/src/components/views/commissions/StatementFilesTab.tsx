import React from 'react';

import type { DriveFile, Statement } from '../../../types';
import { FileUploadManager } from '../../FileUploadManager';
import { BTN_SM_DANGER, BTN_SM_SECONDARY } from '../../common/buttonStyles';
import { InlineAlert } from '../../common/InlineAlert';
import { DriveFilesTable } from '../../common/table/DriveFilesTable';
import {
  LINK_ACTION_XS,
  PANEL_MUTED_TEXT,
  STATUS_BADGE_DANGER_XS,
} from '../../common/uiClassNames';
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
                className={LINK_ACTION_XS}
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
            className={BTN_SM_SECONDARY}
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
          className={BTN_SM_SECONDARY}
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
          className={BTN_SM_DANGER}
        >
          {isStatementDriveTrashing ? 'Удаляю...' : 'Удалить'}
        </button>
        <p className="text-xs text-slate-500">
          {selectedStatementDriveFileIds.length
            ? `${selectedStatementDriveFileIds.length} файл${selectedStatementDriveFileIds.length === 1 ? '' : 'ов'} выбрано`
            : 'Выберите файлы для действий.'}
        </p>
      </div>

      {statementDriveError && <InlineAlert as="p">{statementDriveError}</InlineAlert>}

      {statementDriveTrashMessage && (
        <p className={STATUS_BADGE_DANGER_XS}>{statementDriveTrashMessage}</p>
      )}

      {statementDriveDownloadMessage && (
        <p className={STATUS_BADGE_DANGER_XS}>{statementDriveDownloadMessage}</p>
      )}

      {!statementDriveError &&
        hasStatementDriveFolder &&
        !isStatementDriveLoading &&
        sortedStatementDriveFiles.length === 0 && (
          <div className={PANEL_MUTED_TEXT}>Папка пуста.</div>
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
                  className={LINK_ACTION_XS}
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
                className={`${LINK_ACTION_XS} disabled:text-slate-300`}
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
                className={`${LINK_ACTION_XS} disabled:text-slate-300`}
              >
                Удалить
              </button>
            </div>
          )}
          emptyMessage="Папка пуста."
        />
      )}
    </section>
  );
};
