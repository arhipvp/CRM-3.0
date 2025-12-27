import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Deal, DriveFile, PolicyRecognitionResult } from '../../../../types';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import {
  fetchDealDriveFiles,
  trashDealDriveFiles,
  uploadDealDriveFile,
  renameDealDriveFile,
  recognizeDealPolicies,
} from '../../../../api';

interface UseDealDriveFilesParams {
  selectedDeal: Deal | null;
  onDriveFolderCreated: (dealId: string, folderId: string) => void;
  onRefreshPolicies?: () => Promise<void>;
  onPolicyDraftReady?: (
    dealId: string,
    parsed: Record<string, unknown>,
    fileName?: string | null,
    fileId?: string | null,
    parsedFileIds?: string[]
  ) => void;
}

export const useDealDriveFiles = ({
  selectedDeal,
  onDriveFolderCreated,
  onRefreshPolicies,
  onPolicyDraftReady,
}: UseDealDriveFilesParams) => {
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [isDriveLoading, setIsDriveLoading] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);
  const [selectedDriveFileIds, setSelectedDriveFileIds] = useState<string[]>([]);
  const [isRecognizing, setRecognizing] = useState(false);
  const [recognitionResults, setRecognitionResults] = useState<PolicyRecognitionResult[]>([]);
  const [recognitionMessage, setRecognitionMessage] = useState<string | null>(null);
  const [isTrashing, setIsTrashing] = useState(false);
  const [trashMessage, setTrashMessage] = useState<string | null>(null);
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
    setTrashMessage(null);
    setRenameMessage(null);
  }, [selectedDeal?.id]);

  useEffect(() => {
    if (!selectedDriveFileIds.length) {
      return;
    }
    const fileIds = new Set(driveFiles.map((file) => file.id));
    setSelectedDriveFileIds((prev) => {
      const filtered = prev.filter((id) => fileIds.has(id));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [driveFiles, selectedDriveFileIds.length]);

  const loadDriveFiles = useCallback(async () => {
    const deal = selectedDeal;
    if (!deal) {
      setDriveFiles([]);
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
      setDriveFiles(files);
      setDriveError(null);
      if (folderId && folderId !== previousFolderId) {
        onDriveFolderCreated(currentDealId, folderId);
      }
    } catch (error) {
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      console.error('Ошибка загрузки файлов Google Drive:', error);
      setDriveFiles([]);
      setDriveError(
        formatErrorMessage(error, 'Не удалось загрузить файлы из Google Drive.')
      );
    } finally {
      if (latestDealIdRef.current === currentDealId) {
        setIsDriveLoading(false);
      }
    }
  }, [onDriveFolderCreated, selectedDeal]);

  const handleDriveFileUpload = useCallback(
    async (file: File) => {
      if (!selectedDeal) {
        return;
      }
      await uploadDealDriveFile(selectedDeal.id, file, Boolean(selectedDeal.deletedAt));
    },
    [selectedDeal]
  );

  const resetDriveState = useCallback(() => {
    setDriveFiles([]);
    setDriveError(null);
  }, []);

  const toggleDriveFileSelection = useCallback((fileId: string) => {
    setSelectedDriveFileIds((prev) =>
      prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]
    );
  }, []);

  const selectedDriveFiles = useMemo(
    () =>
      selectedDriveFileIds
        .map((id) => driveFiles.find((file) => file.id === id))
        .filter((file): file is DriveFile => Boolean(file)),
    [driveFiles, selectedDriveFileIds]
  );

  const canRecognizeSelectedFiles = useMemo(
    () =>
      selectedDriveFileIds.length > 0 &&
      selectedDriveFiles.length === selectedDriveFileIds.length &&
      selectedDriveFiles.every(
        (file) => file.mimeType?.toLowerCase() === 'application/pdf'
      ),
    [selectedDriveFileIds, selectedDriveFiles]
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
      setRecognitionMessage('Можно распознавать только PDF-файлы.');
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
      const parsed = results.find(
        (result) => result.status === 'parsed' && result.data
      );
      if (parsed && onPolicyDraftReady) {
        onPolicyDraftReady(
          currentDealId,
          parsed.data!,
          parsed.fileName ?? null,
          parsed.fileId ?? null,
          parsedFileIds
        );
      }
      if (onRefreshPolicies) {
        await onRefreshPolicies();
      }
    } catch (error) {
      if (latestDealIdRef.current !== currentDealId) {
        return;
      }
      console.error('Ошибка распознавания полисов:', error);
      setRecognitionMessage(
        error instanceof Error
          ? error.message
          : 'Не удалось распознать полисы. Попробуйте позже.'
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

  const handleTrashSelectedFiles = useCallback(async () => {
    const deal = selectedDeal;
    if (!deal) {
      return;
    }

    if (!selectedDriveFileIds.length) {
      setTrashMessage('Выберите файлы для удаления.');
      return;
    }

    const confirmText = `Переместить ${selectedDriveFileIds.length} файл${selectedDriveFileIds.length === 1 ? '' : 'ов'} в корзину?`;
    if (typeof window !== 'undefined' && !window.confirm(confirmText)) {
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
      console.error('Ошибка перемещения файлов в корзину:', error);
      setTrashMessage(formatErrorMessage(error, 'Не удалось переместить файлы в корзину.'));
    } finally {
      if (latestDealIdRef.current === currentDealId) {
        setIsTrashing(false);
      }
    }
  }, [loadDriveFiles, selectedDeal, selectedDriveFileIds]);

  const handleRenameDriveFile = useCallback(
    async (fileId: string, name: string) => {
      const deal = selectedDeal;
      if (!deal) {
        return;
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        setRenameMessage('РќР°Р·РІР°РЅРёРµ С„Р°Р№Р»Р° РЅРµ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РїСѓСЃС‚С‹Рј.');
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
          Boolean(deal.deletedAt)
        );
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        setDriveFiles((prev) =>
          prev.map((file) => (file.id === updated.id ? { ...file, ...updated } : file))
        );
      } catch (error) {
        if (latestDealIdRef.current !== currentDealId) {
          return;
        }
        console.error('РћС€РёР±РєР° РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёСЏ С„Р°Р№Р»Р°:', error);
        setRenameMessage(
          formatErrorMessage(error, 'РќРµ СѓРґР°Р»РѕСЃСЊ РїРµСЂРµРёРјРµРЅРѕРІР°С‚СЊ С„Р°Р№Р».')
        );
      } finally {
        if (latestDealIdRef.current === currentDealId) {
          setIsRenaming(false);
        }
      }
    },
    [selectedDeal]
  );

  const sortedDriveFiles = useMemo(() => {
    return [...driveFiles].sort((a, b) => {
      const multiplier = driveSortDirection === 'asc' ? 1 : -1;
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
  }, [driveFiles, driveSortDirection]);

  const toggleDriveSortDirection = useCallback(() => {
    setDriveSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
  }, []);

  return {
    isDriveLoading,
    driveError,
    selectedDriveFileIds,
    canRecognizeSelectedFiles,
    isRecognizing,
    recognitionResults,
    recognitionMessage,
    isTrashing,
    trashMessage,
    isRenaming,
    renameMessage,
    sortedDriveFiles,
    driveSortDirection,
    loadDriveFiles,
    handleDriveFileUpload,
    toggleDriveFileSelection,
    toggleDriveSortDirection,
    handleRecognizePolicies,
    handleTrashSelectedFiles,
    handleRenameDriveFile,
    resetDriveState,
  };
};
