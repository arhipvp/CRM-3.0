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
              const canSelect = showSelection && !isSelectionDisabled?.(file);

              return (
                <tr key={file.id} className={TABLE_ROW_CLASS_PLAIN}>
                  {showSelection && (
                    <td className={TABLE_CELL_CLASS_SM}>
                      <input
                        type="checkbox"
                        checked={selectedFileIds.includes(file.id)}
                        disabled={!canSelect}
                        onChange={() => onToggleSelection?.(file.id)}
                        className="check rounded-sm"
                        aria-label={`Выбрать файл: ${file.name}`}
                      />
                    </td>
                  )}
                  <td className={TABLE_CELL_CLASS_SM}>
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="text-lg">{getDriveItemIcon(file.isFolder)}</span>
                      <div className="min-w-0">
                        <p className="break-all text-sm font-semibold text-slate-900">
                          {file.name}
                        </p>
                        <p className="text-xs text-slate-500">{file.mimeType || '—'}</p>
                      </div>
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
