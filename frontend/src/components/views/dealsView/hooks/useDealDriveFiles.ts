import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { Deal, DriveFile, PolicyRecognitionResult } from '../../../../types';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import {
  fetchDealDriveFiles,
  uploadDealDriveFile,
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
  const latestDealIdRef = useRef<string | null>(selectedDeal?.id ?? null);

  useEffect(() => {
    latestDealIdRef.current = selectedDeal?.id ?? null;
  }, [selectedDeal?.id]);

  useEffect(() => {
    setSelectedDriveFileIds([]);
    setRecognitionResults([]);
    setRecognitionMessage(null);
  }, [selectedDeal?.id]);

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

  const sortedDriveFiles = useMemo(() => {
    return [...driveFiles].sort((a, b) => {
      if (a.isFolder !== b.isFolder) {
        return a.isFolder ? -1 : 1;
      }
      return a.name.localeCompare(b.name, 'ru-RU', { sensitivity: 'base' });
    });
  }, [driveFiles]);

  return {
    isDriveLoading,
    driveError,
    selectedDriveFileIds,
    canRecognizeSelectedFiles,
    isRecognizing,
    recognitionResults,
    recognitionMessage,
    sortedDriveFiles,
    loadDriveFiles,
    handleDriveFileUpload,
    toggleDriveFileSelection,
    handleRecognizePolicies,
    resetDriveState,
  };
};
