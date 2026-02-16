import React, { useCallback, useEffect, useState } from 'react';

import {
  fetchClientDriveFiles,
  fetchPolicyDriveFiles,
  uploadClientDriveFile,
  uploadPolicyDriveFile,
} from '../api';
import type { DriveFile } from '../types';
import { formatErrorMessage } from '../utils/formatErrorMessage';
import { formatDateTimeRu } from '../utils/formatting';
import { InlineAlert } from './common/InlineAlert';
import { DriveFilesTable } from './common/table/DriveFilesTable';
import { FileUploadManager } from './FileUploadManager';
import { Modal } from './Modal';

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
    if (!entityId) {
      return;
    }

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

        {error && <InlineAlert>{error}</InlineAlert>}

        {isLoading ? (
          <div className="py-8 text-center text-slate-500">Загрузка...</div>
        ) : (
          <div className="app-panel overflow-hidden shadow-none">
            <DriveFilesTable
              files={sortedFiles}
              renderDate={(file) => formatDateTimeRu(file.modifiedAt || file.createdAt)}
              renderSize={(file) => formatDriveFileSize(file.size)}
              renderActions={(file) => (
                <div className="flex items-center justify-end gap-3">
                  {file.webViewLink ? (
                    <a
                      href={file.webViewLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link-action text-[11px] font-semibold"
                      title={file.name}
                    >
                      Открыть
                    </a>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </div>
              )}
              emptyMessage="Папка пуста"
            />
          </div>
        )}
      </div>
    </Modal>
  );
};
