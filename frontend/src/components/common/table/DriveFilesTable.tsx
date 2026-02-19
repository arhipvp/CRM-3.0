import React from 'react';

import type { DriveFile } from '../../../types';
import { TableHeadCell } from '../TableHeadCell';
import { TABLE_CELL_CLASS_SM, TABLE_ROW_CLASS_PLAIN, TABLE_THEAD_CLASS } from '../tableStyles';

interface DriveFilesTableProps {
  files: DriveFile[];
  emptyMessage: string;
  selectedFileIds?: string[];
  onToggleSelection?: (fileId: string) => void;
  isSelectionDisabled?: (file: DriveFile) => boolean;
  expandedFolderIds?: Set<string>;
  onToggleFolder?: (folderId: string) => void;
  isFolderLoading?: (folderId: string) => boolean;
  getRowDepth?: (file: DriveFile) => number;
  isFolderRowSelectable?: boolean;
  dateHeaderContent?: React.ReactNode;
  dateHeaderAriaSort?: 'none' | 'ascending' | 'descending' | 'other';
  renderDate: (file: DriveFile) => string;
  renderSize: (file: DriveFile) => string;
  renderActions: (file: DriveFile) => React.ReactNode;
}

const getDriveItemIcon = (isFolder: boolean) => (isFolder ? '📁' : '📄');

export const DriveFilesTable: React.FC<DriveFilesTableProps> = ({
  files,
  emptyMessage,
  selectedFileIds = [],
  onToggleSelection,
  isSelectionDisabled,
  expandedFolderIds,
  onToggleFolder,
  isFolderLoading,
  getRowDepth,
  isFolderRowSelectable = false,
  dateHeaderContent,
  dateHeaderAriaSort,
  renderDate,
  renderSize,
  renderActions,
}) => {
  const showSelection = Boolean(onToggleSelection);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className={TABLE_THEAD_CLASS}>
            <tr>
              {showSelection && (
                <TableHeadCell padding="sm" className="w-10">
                  <span className="sr-only">Выбор</span>
                </TableHeadCell>
              )}
              <TableHeadCell padding="sm">Файл</TableHeadCell>
              <TableHeadCell padding="sm" align="right">
                Размер
              </TableHeadCell>
              <TableHeadCell padding="sm" align="right" aria-sort={dateHeaderAriaSort}>
                {dateHeaderContent ?? 'Дата'}
              </TableHeadCell>
              <TableHeadCell padding="sm" align="right">
                Действия
              </TableHeadCell>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const isExpanded = Boolean(file.isFolder && expandedFolderIds?.has(file.id));
              const showFolderToggle = Boolean(file.isFolder && onToggleFolder);
              const folderLoading = Boolean(file.isFolder && isFolderLoading?.(file.id));
              const depth = getRowDepth?.(file) ?? 0;
              const canSelect =
                showSelection &&
                (!file.isFolder || isFolderRowSelectable) &&
                !isSelectionDisabled?.(file);
              const indentStyle = depth > 0 ? { paddingLeft: `${depth * 20}px` } : undefined;

              return (
                <tr
                  key={file.id}
                  id={`drive-folder-row-${file.id}`}
                  className={TABLE_ROW_CLASS_PLAIN}
                >
                  {showSelection && (
                    <td className={TABLE_CELL_CLASS_SM}>
                      {!file.isFolder || isFolderRowSelectable ? (
                        <input
                          type="checkbox"
                          checked={selectedFileIds.includes(file.id)}
                          disabled={!canSelect}
                          onChange={() => onToggleSelection?.(file.id)}
                          className="check rounded-sm"
                          aria-label={`Выбрать файл: ${file.name}`}
                        />
                      ) : (
                        <span className="block h-4 w-4" aria-hidden="true" />
                      )}
                    </td>
                  )}
                  <td className={TABLE_CELL_CLASS_SM}>
                    <div className="flex min-w-0 items-center gap-2" style={indentStyle}>
                      {showFolderToggle ? (
                        <button
                          type="button"
                          className="inline-flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-1"
                          onClick={() => onToggleFolder?.(file.id)}
                          aria-expanded={isExpanded}
                          aria-controls={`drive-folder-row-${file.id}`}
                          aria-label={
                            isExpanded
                              ? `Свернуть папку ${file.name}`
                              : `Раскрыть папку ${file.name}`
                          }
                        >
                          <span aria-hidden="true">{isExpanded ? '▾' : '▸'}</span>
                        </button>
                      ) : (
                        <span className="inline-block h-5 w-5" aria-hidden="true" />
                      )}
                      <span className="text-lg">{getDriveItemIcon(file.isFolder)}</span>
                      <div className="min-w-0">
                        <p className="break-all text-sm font-semibold text-slate-900">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500">{file.mimeType || '—'}</p>
                      </div>
                      {folderLoading && (
                        <span
                          className="inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-sky-600 animate-spin"
                          aria-label={`Загружаю папку ${file.name}`}
                        />
                      )}
                    </div>
                  </td>
                  <td className={`${TABLE_CELL_CLASS_SM} text-right text-xs text-slate-500`}>
                    {renderSize(file)}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_SM} text-right text-xs text-slate-500`}>
                    {renderDate(file)}
                  </td>
                  <td className={`${TABLE_CELL_CLASS_SM} text-right`}>{renderActions(file)}</td>
                </tr>
              );
            })}
            {files.length === 0 && (
              <tr>
                <td
                  colSpan={showSelection ? 5 : 4}
                  className="px-4 py-8 text-center text-sm text-slate-600"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
