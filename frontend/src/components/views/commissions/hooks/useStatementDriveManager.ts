import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  downloadStatementDriveFiles,
  fetchStatementDriveFiles,
  trashStatementDriveFiles,
  uploadStatementDriveFile,
} from '../../../../api';
import { confirmTexts } from '../../../../constants/confirmTexts';
import type { DriveFile, Statement } from '../../../../types';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import { buildDriveFolderLink } from '../../../../utils/links';
import type { ConfirmDialogOptions } from '../../../../constants/confirmTexts';

interface UseStatementDriveManagerArgs {
  selectedStatement?: Statement;
  statementTab: 'records' | 'files';
  viewMode: 'all' | 'statements';
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

export const useStatementDriveManager = ({
  selectedStatement,
  statementTab,
  viewMode,
  confirm,
}: UseStatementDriveManagerArgs) => {
  const [statementDriveFiles, setStatementDriveFiles] = useState<DriveFile[]>([]);
  const [statementDriveFolderIds, setStatementDriveFolderIds] = useState<
    Record<string, string | null>
  >({});
  const [selectedStatementDriveFileIds, setSelectedStatementDriveFileIds] = useState<string[]>([]);
  const [isStatementDriveLoading, setStatementDriveLoading] = useState(false);
  const [isStatementDriveUploading, setStatementDriveUploading] = useState(false);
  const [isStatementDriveTrashing, setStatementDriveTrashing] = useState(false);
  const [isStatementDriveDownloading, setStatementDriveDownloading] = useState(false);
  const [statementDriveError, setStatementDriveError] = useState<string | null>(null);
  const [statementDriveTrashMessage, setStatementDriveTrashMessage] = useState<string | null>(null);
  const [statementDriveDownloadMessage, setStatementDriveDownloadMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setSelectedStatementDriveFileIds([]);
    setStatementDriveTrashMessage(null);
    setStatementDriveDownloadMessage(null);
  }, [selectedStatement?.id]);

  useEffect(() => {
    if (!selectedStatementDriveFileIds.length) {
      return;
    }
    const existingIds = new Set(statementDriveFiles.map((file) => file.id));
    setSelectedStatementDriveFileIds((prev) => {
      const filtered = prev.filter((id) => existingIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [selectedStatementDriveFileIds.length, statementDriveFiles]);

  const loadStatementDriveFiles = useCallback(async (statementId: string) => {
    setStatementDriveLoading(true);
    try {
      const { files, folderId } = await fetchStatementDriveFiles(statementId);
      setStatementDriveFiles(files);
      setStatementDriveError(null);
      if (folderId !== undefined) {
        setStatementDriveFolderIds((prev) => ({
          ...prev,
          [statementId]: folderId,
        }));
      }
    } catch (error) {
      setStatementDriveFiles([]);
      setStatementDriveError(formatErrorMessage(error, 'Не удалось загрузить файлы ведомости.'));
    } finally {
      setStatementDriveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewMode !== 'statements' || !selectedStatement) {
      setStatementDriveFiles([]);
      setStatementDriveError(null);
      return;
    }
    if (statementTab !== 'files') {
      return;
    }
    void loadStatementDriveFiles(selectedStatement.id);
  }, [loadStatementDriveFiles, selectedStatement, statementTab, viewMode]);

  const selectedStatementDriveFolderId = selectedStatement
    ? (statementDriveFolderIds[selectedStatement.id] ?? selectedStatement.driveFolderId ?? null)
    : null;
  const statementDriveFolderLink = buildDriveFolderLink(selectedStatementDriveFolderId);

  const sortedStatementDriveFiles = useMemo(() => {
    return [...statementDriveFiles].sort((a, b) => {
      const rawDateA = new Date(a.modifiedAt ?? a.createdAt ?? 0).getTime();
      const rawDateB = new Date(b.modifiedAt ?? b.createdAt ?? 0).getTime();
      const dateA = Number.isNaN(rawDateA) ? 0 : rawDateA;
      const dateB = Number.isNaN(rawDateB) ? 0 : rawDateB;
      if (dateA !== dateB) {
        return dateB - dateA;
      }
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'ru-RU', { sensitivity: 'base' });
    });
  }, [statementDriveFiles]);

  const toggleStatementDriveFileSelection = useCallback((fileId: string) => {
    setSelectedStatementDriveFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId],
    );
  }, []);

  const handleTrashSelectedStatementDriveFiles = useCallback(async () => {
    if (!selectedStatement) {
      return;
    }
    if (!selectedStatementDriveFileIds.length) {
      setStatementDriveTrashMessage('Выберите хотя бы один файл для удаления.');
      return;
    }
    const confirmed = await confirm(
      confirmTexts.deleteStatementDriveFiles(selectedStatementDriveFileIds.length),
    );
    if (!confirmed) {
      return;
    }
    setStatementDriveTrashing(true);
    setStatementDriveTrashMessage(null);
    try {
      await trashStatementDriveFiles(selectedStatement.id, selectedStatementDriveFileIds);
      setSelectedStatementDriveFileIds([]);
      await loadStatementDriveFiles(selectedStatement.id);
    } catch (error) {
      setStatementDriveTrashMessage(formatErrorMessage(error, 'Не удалось удалить файлы.'));
    } finally {
      setStatementDriveTrashing(false);
    }
  }, [confirm, loadStatementDriveFiles, selectedStatement, selectedStatementDriveFileIds]);

  const handleDownloadStatementDriveFiles = useCallback(
    async (fileIds?: string[]) => {
      if (!selectedStatement) {
        return;
      }
      const targetIds = fileIds?.length ? fileIds : selectedStatementDriveFileIds;
      if (!targetIds.length) {
        setStatementDriveDownloadMessage('Выберите хотя бы один файл для скачивания.');
        return;
      }
      setStatementDriveDownloading(true);
      setStatementDriveDownloadMessage(null);
      try {
        const { blob, filename } = await downloadStatementDriveFiles(
          selectedStatement.id,
          targetIds,
        );
        if (typeof window === 'undefined') {
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        let resolvedFilename = filename;
        if (!resolvedFilename && targetIds.length === 1) {
          const targetFile = statementDriveFiles.find((file) => file.id === targetIds[0]);
          if (targetFile) {
            resolvedFilename = targetFile.name;
          }
        }
        link.download = resolvedFilename || 'files.zip';
        window.document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        setStatementDriveDownloadMessage(formatErrorMessage(error, 'Не удалось скачать файлы.'));
      } finally {
        setStatementDriveDownloading(false);
      }
    },
    [selectedStatement, selectedStatementDriveFileIds, statementDriveFiles],
  );

  const handleStatementDriveDelete = useCallback(
    async (file: DriveFile) => {
      if (!selectedStatement || file.isFolder) {
        return;
      }
      const confirmed = await confirm(confirmTexts.deleteStatementDriveFile(file.name));
      if (!confirmed) {
        return;
      }
      setStatementDriveTrashing(true);
      try {
        await trashStatementDriveFiles(selectedStatement.id, [file.id]);
        await loadStatementDriveFiles(selectedStatement.id);
      } catch (error) {
        setStatementDriveError(formatErrorMessage(error, 'Не удалось удалить файл.'));
      } finally {
        setStatementDriveTrashing(false);
      }
    },
    [confirm, loadStatementDriveFiles, selectedStatement],
  );

  const handleUploadStatementDriveFile = useCallback(
    async (file: File) => {
      if (!selectedStatement) {
        return;
      }
      setStatementDriveUploading(true);
      try {
        await uploadStatementDriveFile(selectedStatement.id, file);
        await loadStatementDriveFiles(selectedStatement.id);
        setStatementDriveError(null);
      } catch (error) {
        setStatementDriveError(formatErrorMessage(error, 'Не удалось загрузить файл.'));
      } finally {
        setStatementDriveUploading(false);
      }
    },
    [loadStatementDriveFiles, selectedStatement],
  );

  return {
    isStatementDriveLoading,
    isStatementDriveUploading,
    isStatementDriveTrashing,
    isStatementDriveDownloading,
    selectedStatementDriveFileIds,
    statementDriveError,
    statementDriveTrashMessage,
    statementDriveDownloadMessage,
    statementDriveFolderLink,
    hasStatementDriveFolder: Boolean(selectedStatementDriveFolderId),
    sortedStatementDriveFiles,
    loadStatementDriveFiles,
    setStatementDriveDownloadMessage,
    toggleStatementDriveFileSelection,
    handleTrashSelectedStatementDriveFiles,
    handleDownloadStatementDriveFiles,
    handleStatementDriveDelete,
    handleUploadStatementDriveFile,
  };
};
