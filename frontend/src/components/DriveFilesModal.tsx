import React, { useCallback, useEffect, useState } from 'react';
import { DriveFile } from '../types';
import {
  fetchClientDriveFiles,
  fetchPolicyDriveFiles,
  uploadClientDriveFile,
  uploadPolicyDriveFile,
} from '../api';
import { FileUploadManager } from './FileUploadManager';
import { Modal } from './Modal';
import { TableHeadCell } from './common/TableHeadCell';
import { TABLE_CELL_CLASS_MD, TABLE_ROW_CLASS, TABLE_THEAD_CLASS } from './common/tableStyles';
import { formatErrorMessage } from '../utils/formatErrorMessage';
import { formatDateTimeRu } from '../utils/formatting';

interface DriveFilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityId: string;
  entityType: 'client' | 'policy';
  title: string;
}

const formatDriveFileSize = (bytes?: number | null) => {
  if (bytes === undefined || bytes === null) {
    return '—';
  }
  if (bytes === 0) {
    return '0 Б';
  }
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${(bytes / Math.pow(k, i)).toFixed(1).replace(/\.0$/, '')} ${sizes[i]}`;
};

const getDriveItemIcon = (isFolder: boolean) => (isFolder ? '📁' : '📄');

export const DriveFilesModal: React.FC<DriveFilesModalProps> = ({
  isOpen,
  onClose,
  entityId,
  entityType,
  title,
}) => {
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    if (!entityId) return;

    setIsLoading(true);
    setError(null);
    try {
      const fetcher = entityType === 'client' ? fetchClientDriveFiles : fetchPolicyDriveFiles;
      const { files: fetchedFiles } = await fetcher(entityId);
      setFiles(fetchedFiles);
    } catch (err) {
      console.error('Ошибка загрузки файлов:', err);
      setError(formatErrorMessage(err, 'Не удалось загрузить файлы'));
    } finally {
      setIsLoading(false);
    }
  }, [entityId, entityType]);

  useEffect(() => {
    if (isOpen) {
      void loadFiles();
    }
  }, [isOpen, loadFiles]);

  const handleUpload = async (file: File) => {
    const uploader = entityType === 'client' ? uploadClientDriveFile : uploadPolicyDriveFile;
    await uploader(entityId, file);
    await loadFiles();
  };

  const sortedFiles = [...files].sort((a, b) => {
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'ru-RU', { sensitivity: 'base' });
  });

  return (
    <Modal onClose={onClose} title={title} size="lg">
      <div className="space-y-6">
        <FileUploadManager onUpload={handleUpload} />

        {error && <div className="app-alert app-alert-danger">{error}</div>}

        {isLoading ? (
          <div className="text-center py-8 text-slate-500">Загрузка...</div>
        ) : (
          <div className="app-panel shadow-none overflow-hidden">
            <div className="overflow-x-auto bg-white">
              <table className="deals-table min-w-full border-collapse text-left text-sm">
                <thead className={TABLE_THEAD_CLASS}>
                  <tr>
                    <TableHeadCell padding="md">Имя</TableHeadCell>
                    <TableHeadCell padding="md" className="w-[140px]">
                      Размер
                    </TableHeadCell>
                    <TableHeadCell padding="md" className="w-[180px]">
                      Изменён
                    </TableHeadCell>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {sortedFiles.map((file) => (
                    <tr key={file.id} className={TABLE_ROW_CLASS}>
                      <td className={TABLE_CELL_CLASS_MD}>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getDriveItemIcon(file.isFolder)}</span>
                          {file.webViewLink ? (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="link-action truncate max-w-[220px] sm:max-w-md block"
                              title={file.name}
                            >
                              {file.name}
                            </a>
                          ) : (
                            <span
                              className="font-semibold text-slate-900 truncate max-w-[220px] sm:max-w-md block"
                              title={file.name}
                            >
                              {file.name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${TABLE_CELL_CLASS_MD} text-slate-600 whitespace-nowrap`}>
                        {formatDriveFileSize(file.size)}
                      </td>
                      <td className={`${TABLE_CELL_CLASS_MD} text-slate-600 whitespace-nowrap`}>
                        {formatDateTimeRu(file.modifiedAt || file.createdAt)}
                      </td>
                    </tr>
                  ))}
                  {!files.length && (
                    <tr>
                      <td
                        colSpan={3}
                        className="border border-slate-200 px-4 py-8 text-center text-slate-600"
                      >
                        Папка пуста
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
