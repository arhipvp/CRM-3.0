import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type {
  Deal,
  DocumentRecognitionResult,
  DriveFile,
  PolicyRecognitionResult,
} from '../../../../types';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import {
  downloadDealDriveFiles,
  fetchDealDriveFiles,
  recognizeDealDocuments,
  recognizeDealPolicies,
  renameDealDriveFile,
  trashDealDriveFiles,
  uploadDealDriveFile,
} from '../../../../api';

interface UseDealDriveFilesParams {
  selectedDeal: Deal | null;
  onDriveFolderCreated: (dealId: string, folderId: string) => void;
  onConfirmAction?: (message: string) => Promise<boolean>;
  onConfirmDeleteFile?: (fileName: string) => Promise<boolean>;
  onRefreshPolicies?: () => Promise<void>;
  onRefreshNotes?: () => Promise<void>;
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null,
    fileId?: string | null,
    parsedFileIds?: string[],
  ) => void;
}

const sortDriveFiles = (files: DriveFile[], direction: 'asc' | 'desc'): DriveFile[] => {
  return [...files].sort((a, b) => {
    const multiplier = direction === 'asc' ? 1 : -1;
    const rawDateA = new Date(a.modifiedAt ?? a.createdAt ?? 0).getTime();
    const rawDateB = new Date(b.modifiedAt ?? b.createdAt ?? 0).getTime();
    const dateA = Number.isNaN(rawDateA) ? 0 : rawDateA;
    const dateB = Number.isNaN(rawDateB) ? 0 : rawDateB;
    if (dateA !== dateB) {
      return (dateA - dateB) * multiplier;
    }
    if (a.isFolder !== b.isFolder) {
      return a.isFolder ? -1 : 1;
    }
    return a.name.localeCompare(b.name, 'ru-RU', { sensitivity: 'base' });
  });
};

const normalizeParent = (files: DriveFile[], parentId: string | null): DriveFile[] =>
  files.map((file) => ({
    ...file,
    parentId: file.parentId ?? parentId,
  }));

export const useDealDriveFiles = ({
  selectedDeal,
  onDriveFolderCreated,
  onConfirmAction,
  onConfirmDeleteFile,
  onRefreshPolicies,
  onRefreshNotes,
  onPolicyDraftReady,
}: UseDealDriveFilesParams) => {
  const [rootFiles, setRootFiles] = useState<DriveFile[]>([]);
  const [childrenByParentId, setChildrenByParentId] = useState<Record<string, DriveFile[]>>({});
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [loadingFolderIds, setLoadingFolderIds] = useState<Set<string>>(new Set());
  const [folderErrors, setFolderErrors] = useState<Record<string, string | null>>({});
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<string[]>([]);
  const [isRecognizing, setRecognizing] = useState(false);
  const [recognitionResults, setRecognitionResults] = useState<PolicyRecognitionResult[]>([]);
  const [recognitionMessage, setRecognitionMessage] = useState<string | null>(null);
  const [isDocumentRecognizing, setDocumentRecognizing] = useState(false);
  const [documentRecognitionResults, setDocumentRecognitionResults] = useState<
    DocumentRecognitionResult[]
  >([]);
  const [documentRecognitionMessage, setDocumentRecognitionMessage] = useState<string | null>(null);
  const [isTrashing, setIsTrashing] = useState(false);
  const [trashMessage, setTrashMessage] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState<string | null>(null);
  const [driveSortDirection, setDriveSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameMessage, setRenameMessage] = useState<string | null>(null);
  const latestDealIdRef = useRef<string | null>(selectedDeal?.id ?? null);

  useEffect(() => {
    latestDealIdRef.current = selectedDeal?.id ?? null;
  }, [selectedDeal?.id]);

  useEffect(() => {
    setSelectedDriveFileIds([]);
    setRecognitionResults([]);
    setRecognitionMessage(null);
    setDocumentRecognitionResults([]);
    setDocumentRecognitionMessage(null);
    setTrashMessage(null);
    setDownloadMessage(null);
    setRenameMessage(null);
    setChildrenByParentId({});
    setExpandedFolderIds(new Set());
    setLoadingFolderIds(new Set());
    setFolderErrors({});
  }, [selectedDeal?.id]);

  const sortedRootFiles = useMemo(
    () => sortDriveFiles(rootFiles, driveSortDirection),
    [driveSortDirection, rootFiles],
  );

  const sortedChildrenByParentId = useMemo(() => {
    const result: Record<string, DriveFile[]> = {};
    Object.entries(childrenByParentId).forEach(([parentId, files]) => {
      result[parentId] = sortDriveFiles(files, driveSortDirection);
    });
    return result;
  }, [childrenByParentId, driveSortDirection]);

  const loadFolderContents = useCallback(
    async (folderId: string): Promise<void> => {
      const deal = selectedDeal;
      if (!deal || !folderId) {
        return;
      }
      const currentDealId = deal.id;
      const includeDeleted = Boolean(deal.deletedAt);
      latestDealIdRef.current = currentDealId;
      setLoadingFolderIds((prev) => {
        const next = new Set(prev);
        next.add(folderId);
        return next;
      });
      setFolderErrors((prev) => ({ ...prev, [folderId]: null }));

      try {
        const { files } = await fetchDealDriveFiles(currentDealId, includeDeleted, folderId);
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        setChildrenByParentId((prev) => ({
          ...prev,
          [folderId]: normalizeParent(files, folderId),
        }));
      } catch (error) {
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        setFolderErrors((prev) => ({
          ...prev,
          [folderId]: formatErrorMessage(error, 'Не удалось загрузить содержимое папки.'),
        }));
      } finally {
        if (latestDealIdRef.current === currentDealId) {
          setLoadingFolderIds((prev) => {
            const next = new Set(prev);
            next.delete(folderId);
            return next;
          });
        }
      }
    },
    [selectedDeal],
  );

  const loadDriveFiles = useCallback(async () => {
    const deal = selectedDeal;
    if (!deal) {
      setRootFiles([]);
      setChildrenByParentId({});
      setDriveError(null);
      return;
    }

    const currentDealId = deal.id;
    const includeDeleted = Boolean(deal.deletedAt);
    const previousFolderId = deal.driveFolderId;
    latestDealIdRef.current = currentDealId;
    setIsDriveLoading(true);

    try {
      const { files, folderId } = await fetchDealDriveFiles(currentDealId, includeDeleted);
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }

      setRootFiles(normalizeParent(files, null));
      setDriveError(null);

      if (folderId && folderId !== previousFolderId) {
        onDriveFolderCreated(currentDealId, folderId);
      }

      const foldersToRefresh = Array.from(expandedFolderIds);
      if (foldersToRefresh.length) {
        await Promise.all(
          foldersToRefresh.map((expandedFolderId) => loadFolderContents(expandedFolderId)),
        );
      }
    } catch (error) {
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      console.error('Ошибка Google Drive:', error);
      setRootFiles([]);
      setChildrenByParentId({});
      setDriveError(formatErrorMessage(error, 'Не удалось загрузить файлы из Google Drive.'));
    } finally {
      if (latestDealIdRef.current === currentDealId) {
        setIsDriveLoading(false);
      }
    }
  }, [expandedFolderIds, loadFolderContents, onDriveFolderCreated, selectedDeal]);

  const handleDriveFileUpload = useCallback(
    async (file: File) => {
      if (!selectedDeal) {
        return;
      }
      await uploadDealDriveFile(selectedDeal.id, file, Boolean(selectedDeal.deletedAt));
    },
    [selectedDeal],
  );

  const resetDriveState = useCallback(() => {
    setRootFiles([]);
    setChildrenByParentId({});
    setDriveError(null);
  }, []);

  const sortedDriveFiles = useMemo(() => {
    const flattened: DriveFile[] = [];
    const traverse = (files: DriveFile[]) => {
      files.forEach((file) => {
        flattened.push(file);
        if (file.isFolder && expandedFolderIds.has(file.id)) {
          traverse(sortedChildrenByParentId[file.id] ?? []);
        }
      });
    };
    traverse(sortedRootFiles);
    return flattened;
  }, [expandedFolderIds, sortedChildrenByParentId, sortedRootFiles]);

  const fileDepthMap = useMemo(() => {
    const map = new Map<string, number>();
    const traverse = (files: DriveFile[], depth: number) => {
      files.forEach((file) => {
        map.set(file.id, depth);
        if (file.isFolder && expandedFolderIds.has(file.id)) {
          traverse(sortedChildrenByParentId[file.id] ?? [], depth + 1);
        }
      });
    };
    traverse(sortedRootFiles, 0);
    return map;
  }, [expandedFolderIds, sortedChildrenByParentId, sortedRootFiles]);

  const getDriveFileDepth = useCallback(
    (fileId: string): number => {
      return fileDepthMap.get(fileId) ?? 0;
    },
    [fileDepthMap],
  );

  const isFolderLoading = useCallback(
    (folderId: string): boolean => loadingFolderIds.has(folderId),
    [loadingFolderIds],
  );

  const toggleFolderExpanded = useCallback(
    (folderId: string) => {
      if (!folderId) {
        return;
      }
      const hasLoadedChildren = childrenByParentId[folderId] !== undefined;
      const isExpanded = expandedFolderIds.has(folderId);

      if (isExpanded) {
        setExpandedFolderIds((prev) => {
          const next = new Set(prev);
          next.delete(folderId);
          return next;
        });
        return;
      }

      setExpandedFolderIds((prev) => {
        const next = new Set(prev);
        next.add(folderId);
        return next;
      });

      if (!hasLoadedChildren && !loadingFolderIds.has(folderId)) {
        void loadFolderContents(folderId);
      }
    },
    [childrenByParentId, expandedFolderIds, loadFolderContents, loadingFolderIds],
  );

  useEffect(() => {
    if (!selectedDriveFileIds.length) {
      return;
    }
    const fileMap = new Map(sortedDriveFiles.map((file) => [file.id, file]));
    setSelectedDriveFileIds((prev) => {
      const filtered = prev.filter((id) => {
        const file = fileMap.get(id);
        return Boolean(file && !file.isFolder);
      });
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [selectedDriveFileIds.length, sortedDriveFiles]);

  const toggleDriveFileSelection = useCallback(
    (fileId: string) => {
      const target = sortedDriveFiles.find((file) => file.id === fileId);
      if (!target || target.isFolder) {
        return;
      }
      setSelectedDriveFileIds((prev) =>
        prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId],
      );
    },
    [sortedDriveFiles],
  );

  const selectedDriveFiles = useMemo(
    () =>
      selectedDriveFileIds
        .map((id) => sortedDriveFiles.find((file) => file.id === id))
        .filter((file): file is DriveFile => Boolean(file && !file.isFolder)),
    [selectedDriveFileIds, sortedDriveFiles],
  );

  const canRecognizeSelectedFiles = useMemo(
    () =>
      selectedDriveFileIds.length > 0 &&
      selectedDriveFiles.length === selectedDriveFileIds.length &&
      selectedDriveFiles.every((file) => file.mimeType?.toLowerCase() === 'application/pdf'),
    [selectedDriveFileIds, selectedDriveFiles],
  );

  const canRecognizeSelectedDocumentFiles = useMemo(
    () =>
      selectedDriveFileIds.length > 0 &&
      selectedDriveFiles.length === selectedDriveFileIds.length &&
      selectedDriveFiles.every((file) => {
        const mimeType = (file.mimeType ?? '').toLowerCase();
        return mimeType === 'application/pdf' || mimeType.startsWith('image/');
      }),
    [selectedDriveFileIds, selectedDriveFiles],
  );

  const handleRecognizePolicies = useCallback(async () => {
    const deal = selectedDeal;
    if (!deal) {
      return;
    }

    if (!selectedDriveFileIds.length) {
      setRecognitionMessage('Выберите хотя бы один файл для распознавания.');
      return;
    }

    if (!canRecognizeSelectedFiles) {
      setRecognitionMessage('Выберите только PDF-файлы.');
      return;
    }

    const currentDealId = deal.id;
    latestDealIdRef.current = currentDealId;
    setRecognizing(true);
    setRecognitionMessage(null);

    try {
      const { results } = await recognizeDealPolicies(currentDealId, selectedDriveFileIds);
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      setRecognitionResults(results);
      setSelectedDriveFileIds([]);
      const parsedFileIds = results
        .filter((result) => result.status === 'parsed' && result.fileId)
        .map((result) => result.fileId!);
      const parsed = results.find((result) => result.status === 'parsed' && result.data);
      if (parsed && onPolicyDraftReady) {
        onPolicyDraftReady(
          currentDealId,
          parsed.data!,
          parsed.fileName ?? null,
          parsed.fileId ?? null,
          parsedFileIds,
        );
      }
      if (onRefreshPolicies) {
        await onRefreshPolicies();
      }
    } catch (error) {
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      console.error('Ошибка распознавания:', error);
      setRecognitionMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось распознать документы. Попробуйте ещё раз.',
      );
    } finally {
      if (latestDealIdRef.current === currentDealId) {
        setRecognizing(false);
      }
    }
  }, [
    canRecognizeSelectedFiles,
    onPolicyDraftReady,
    onRefreshPolicies,
    selectedDeal,
    selectedDriveFileIds,
  ]);

  const handleRecognizeDocuments = useCallback(async () => {
    const deal = selectedDeal;
    if (!deal) {
      return;
    }

    if (!selectedDriveFileIds.length) {
      setDocumentRecognitionMessage('Выберите хотя бы один файл для распознавания.');
      return;
    }

    if (!canRecognizeSelectedDocumentFiles) {
      setDocumentRecognitionMessage('Можно распознавать только PDF и изображения.');
      return;
    }

    const currentDealId = deal.id;
    latestDealIdRef.current = currentDealId;
    setDocumentRecognizing(true);
    setDocumentRecognitionMessage(null);

    try {
      const { results } = await recognizeDealDocuments(currentDealId, selectedDriveFileIds);
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      setDocumentRecognitionResults(results);
      setSelectedDriveFileIds([]);
      if (onRefreshNotes) {
        await onRefreshNotes();
      }
      await loadDriveFiles();
    } catch (error) {
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      console.error('Ошибка распознавания документов:', error);
      setDocumentRecognitionMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось распознать документы. Попробуйте ещё раз.',
      );
    } finally {
      if (latestDealIdRef.current === currentDealId) {
        setDocumentRecognizing(false);
      }
    }
  }, [
    canRecognizeSelectedDocumentFiles,
    loadDriveFiles,
    onRefreshNotes,
    selectedDeal,
    selectedDriveFileIds,
  ]);

  const handleTrashSelectedFiles = useCallback(async () => {
    const deal = selectedDeal;
    if (!deal) {
      return;
    }

    if (!selectedDriveFileIds.length) {
      setTrashMessage('Выберите хотя бы один файл для удаления.');
      return;
    }

    const confirmText = `Удалить выбранные файлы (${selectedDriveFileIds.length})?`;
    const confirmed = onConfirmAction ? await onConfirmAction(confirmText) : true;
    if (!confirmed) {
      return;
    }

    const currentDealId = deal.id;
    latestDealIdRef.current = currentDealId;
    setIsTrashing(true);
    setTrashMessage(null);

    try {
      await trashDealDriveFiles(currentDealId, selectedDriveFileIds, Boolean(deal.deletedAt));
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      setSelectedDriveFileIds([]);
      await loadDriveFiles();
    } catch (error) {
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      console.error('Ошибка удаления:', error);
      setTrashMessage(formatErrorMessage(error, 'Не удалось удалить файлы.'));
    } finally {
      if (latestDealIdRef.current === currentDealId) {
        setIsTrashing(false);
      }
    }
  }, [loadDriveFiles, onConfirmAction, selectedDeal, selectedDriveFileIds]);

  const handleTrashDriveFile = useCallback(
    async (file: DriveFile) => {
      const deal = selectedDeal;
      if (!deal || file.isFolder) {
        return;
      }
      const confirmed = onConfirmDeleteFile ? await onConfirmDeleteFile(file.name) : true;
      if (!confirmed) {
        return;
      }

      const currentDealId = deal.id;
      latestDealIdRef.current = currentDealId;
      setIsTrashing(true);
      setTrashMessage(null);

      try {
        await trashDealDriveFiles(currentDealId, [file.id], Boolean(deal.deletedAt));
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        setSelectedDriveFileIds((prev) => prev.filter((id) => id !== file.id));
        await loadDriveFiles();
      } catch (error) {
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        console.error('Ошибка удаления файла:', error);
        setTrashMessage(formatErrorMessage(error, 'Не удалось удалить файл.'));
      } finally {
        if (latestDealIdRef.current === currentDealId) {
          setIsTrashing(false);
        }
      }
    },
    [loadDriveFiles, onConfirmDeleteFile, selectedDeal],
  );

  const getDriveFileBlob = useCallback(
    async (fileId: string): Promise<Blob> => {
      const deal = selectedDeal;
      if (!deal) {
        throw new Error('Сделка не выбрана.');
      }
      const { blob } = await downloadDealDriveFiles(deal.id, [fileId], Boolean(deal.deletedAt));
      return blob;
    },
    [selectedDeal],
  );

  const handleDownloadDriveFiles = useCallback(
    async (fileIds?: string[]) => {
      const deal = selectedDeal;
      if (!deal) {
        return;
      }
      const targetIds = fileIds?.length ? fileIds : selectedDriveFileIds;
      if (!targetIds.length) {
        setDownloadMessage('Выберите хотя бы один файл для скачивания.');
        return;
      }

      const currentDealId = deal.id;
      latestDealIdRef.current = currentDealId;
      setIsDownloading(true);
      setDownloadMessage(null);

      try {
        const { blob, filename } = await downloadDealDriveFiles(
          currentDealId,
          targetIds,
          Boolean(deal.deletedAt),
        );
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        if (typeof window === 'undefined') {
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const link = window.document.createElement('a');
        link.href = url;
        let resolvedFilename = filename;
        if (!resolvedFilename && targetIds.length === 1) {
          const targetFile = sortedDriveFiles.find((file) => file.id === targetIds[0]);
          if (targetFile) {
            resolvedFilename = targetFile.isFolder
              ? `${targetFile.name || 'folder'}.zip`
              : targetFile.name;
          }
        }
        link.download = resolvedFilename || 'files.zip';
        window.document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (error) {
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        console.error('Ошибка скачивания файлов:', error);
        setDownloadMessage(formatErrorMessage(error, 'Не удалось скачать файлы.'));
      } finally {
        if (latestDealIdRef.current === currentDealId) {
          setIsDownloading(false);
        }
      }
    },
    [selectedDeal, selectedDriveFileIds, sortedDriveFiles],
  );

  const updateFileInTree = useCallback((updatedFile: DriveFile) => {
    setRootFiles((prev) =>
      prev.map((file) => (file.id === updatedFile.id ? { ...file, ...updatedFile } : file)),
    );
    setChildrenByParentId((prev) => {
      const next: Record<string, DriveFile[]> = {};
      Object.entries(prev).forEach(([parentId, files]) => {
        next[parentId] = files.map((file) =>
          file.id === updatedFile.id ? { ...file, ...updatedFile } : file,
        );
      });
      return next;
    });
  }, []);

  const handleRenameDriveFile = useCallback(
    async (fileId: string, name: string) => {
      const deal = selectedDeal;
      if (!deal) {
        return;
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        setRenameMessage('Название файла не должно быть пустым.');
        return;
      }

      const currentDealId = deal.id;
      latestDealIdRef.current = currentDealId;
      setIsRenaming(true);
      setRenameMessage(null);

      try {
        const updated = await renameDealDriveFile(
          currentDealId,
          fileId,
          trimmedName,
          Boolean(deal.deletedAt),
        );
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        updateFileInTree(updated);
      } catch (error) {
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        console.error('Ошибка переименования файла:', error);
        setRenameMessage(formatErrorMessage(error, 'Не удалось переименовать файл.'));
      } finally {
        if (latestDealIdRef.current === currentDealId) {
          setIsRenaming(false);
        }
      }
    },
    [selectedDeal, updateFileInTree],
  );

  const toggleDriveSortDirection = useCallback(() => {
    setDriveSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  return {
    isDriveLoading,
    driveError,
    selectedDriveFileIds,
    canRecognizeSelectedFiles,
    canRecognizeSelectedDocumentFiles,
    isRecognizing,
    recognitionResults,
    recognitionMessage,
    isDocumentRecognizing,
    documentRecognitionResults,
    documentRecognitionMessage,
    isTrashing,
    trashMessage,
    isDownloading,
    downloadMessage,
    isRenaming,
    renameMessage,
    sortedDriveFiles,
    driveSortDirection,
    expandedFolderIds,
    folderErrors,
    loadDriveFiles,
    loadFolderContents,
    toggleFolderExpanded,
    isFolderLoading,
    getDriveFileDepth,
    handleDriveFileUpload,
    toggleDriveFileSelection,
    toggleDriveSortDirection,
    handleRecognizePolicies,
    handleRecognizeDocuments,
    handleTrashSelectedFiles,
    handleTrashDriveFile,
    handleDownloadDriveFiles,
    getDriveFileBlob,
    handleRenameDriveFile,
    resetDriveState,
  };
};
