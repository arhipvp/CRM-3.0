import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Deal, User } from '../../../../types';
import type { DealFormValues } from '../../../forms/DealForm';
import { fetchDeals, previewDealMerge } from '../../../../api';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';

interface UseDealMergeParams {
  deals: Deal[];
  selectedDeal: Deal | null;
  currentUser: User | null;
  onMergeDeals: (
    targetDealId: string,
    sourceDealIds: string[],
    finalDeal: DealFormValues,
    previewSnapshotId?: string,
  ) => Promise<void>;
  debounceDelay?: number;
}

const buildDraftFromDeal = (deal: Deal): DealFormValues => ({
  title: deal.title,
  clientId: deal.clientId,
  description: deal.description ?? '',
  expectedClose: deal.expectedClose ?? null,
  executorId: deal.executor ?? null,
  source: deal.source ?? '',
  sellerId: deal.seller ?? null,
  nextContactDate: deal.nextContactDate ?? null,
  visibleUserIds: deal.visibleUsers ?? [],
});

export const useDealMerge = ({
  deals,
  selectedDeal,
  currentUser,
  onMergeDeals,
  debounceDelay = 300,
}: UseDealMergeParams) => {
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeStep, setMergeStep] = useState<'select' | 'preview'>('select');
  const [mergeSources, setMergeSources] = useState<string[]>([]);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [isMergePreviewLoading, setIsMergePreviewLoading] = useState(false);
  const [mergePreviewWarnings, setMergePreviewWarnings] = useState<string[]>([]);
  const [mergePreviewSnapshotId, setMergePreviewSnapshotId] = useState<string | null>(null);
  const [isMergePreviewConfirmed, setIsMergePreviewConfirmed] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeSearchResults, setMergeSearchResults] = useState<Deal[]>([]);
  const [isMergeSearchLoading, setIsMergeSearchLoading] = useState(false);
  const [mergeFinalDraft, setMergeFinalDraft] = useState<DealFormValues | null>(null);

  const mergeCandidates = useMemo(() => {
    if (!selectedDeal) {
      return [];
    }
    return deals.filter(
      (deal: Deal) =>
        deal.id !== selectedDeal.id && !deal.deletedAt && deal.clientId === selectedDeal.clientId,
    );
  }, [deals, selectedDeal]);

  const resetPreviewState = useCallback(() => {
    setMergePreviewWarnings([]);
    setMergePreviewSnapshotId(null);
    setIsMergePreviewConfirmed(false);
    setMergeFinalDraft(null);
    setMergeStep('select');
  }, []);

  const resetMergeForm = useCallback(() => {
    setMergeSources([]);
    setMergeError(null);
    setMergeSearch('');
    setMergeSearchResults([]);
    setIsMergeSearchLoading(false);
    resetPreviewState();
  }, [resetPreviewState]);

  useEffect(() => {
    resetMergeForm();
  }, [selectedDeal?.id, resetMergeForm]);

  const mergeQuery = mergeSearch.trim();
  const isMergeSearchActive = Boolean(mergeQuery);
  const mergeList = isMergeSearchActive ? mergeSearchResults : mergeCandidates;

  useEffect(() => {
    if (!mergeQuery) {
      setMergeSearchResults([]);
      setIsMergeSearchLoading(false);
      return;
    }

    let isCancelled = false;
    setIsMergeSearchLoading(true);

    const handler = setTimeout(() => {
      (async () => {
        try {
          const filters: Record<string, unknown> = {
            search: mergeQuery,
            page_size: 50,
          };
          if (currentUser?.id) {
            filters.seller = currentUser.id;
          }
          const results = await fetchDeals(filters);
          if (isCancelled) {
            return;
          }
          const filtered = results.filter(
            (deal) =>
              deal.id !== selectedDeal?.id &&
              !deal.deletedAt &&
              deal.clientId === selectedDeal?.clientId,
          );
          setMergeSearchResults(filtered);
        } catch (err) {
          if (!isCancelled) {
            console.error('Ошибка поиска сделок для объединения:', err);
            setMergeSearchResults([]);
          }
        } finally {
          if (!isCancelled) {
            setIsMergeSearchLoading(false);
          }
        }
      })();
    }, debounceDelay);

    return () => {
      isCancelled = true;
      clearTimeout(handler);
    };
  }, [currentUser?.id, mergeQuery, selectedDeal?.id, selectedDeal?.clientId, debounceDelay]);

  const toggleMergeSource = useCallback(
    (dealId: string) => {
      setMergeSources((prev) =>
        prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [...prev, dealId],
      );
      setMergeError(null);
      resetPreviewState();
    },
    [resetPreviewState],
  );

  const requestMergePreview = useCallback(async () => {
    if (!selectedDeal) {
      return;
    }
    if (!mergeSources.length) {
      setMergeError('Выберите сделки для объединения.');
      return;
    }

    setIsMergePreviewLoading(true);
    setMergeError(null);
    try {
      const preview = await previewDealMerge({
        targetDealId: selectedDeal.id,
        sourceDealIds: mergeSources,
        includeDeleted: true,
      });
      setMergePreviewWarnings(preview.warnings ?? []);
      setMergePreviewSnapshotId(`deal-merge-preview:${selectedDeal.id}:${Date.now().toString(36)}`);
      setIsMergePreviewConfirmed(true);
      const draft = preview.finalDealDraft
        ? {
            title: preview.finalDealDraft.title,
            clientId: preview.finalDealDraft.clientId || selectedDeal.clientId,
            description: preview.finalDealDraft.description ?? '',
            expectedClose: preview.finalDealDraft.expectedClose ?? null,
            executorId: preview.finalDealDraft.executorId ?? null,
            source: preview.finalDealDraft.source ?? '',
            sellerId: preview.finalDealDraft.sellerId ?? null,
            nextContactDate: preview.finalDealDraft.nextContactDate ?? null,
            visibleUserIds: preview.finalDealDraft.visibleUserIds ?? [],
          }
        : buildDraftFromDeal(selectedDeal);
      setMergeFinalDraft(draft);
      setMergeStep('preview');
    } catch (err) {
      setMergeError(formatErrorMessage(err, 'Не удалось получить предпросмотр объединения.'));
      setIsMergePreviewConfirmed(false);
      setMergeStep('select');
    } finally {
      setIsMergePreviewLoading(false);
    }
  }, [mergeSources, selectedDeal]);

  const handleMergeSubmit = useCallback(
    async (finalDeal: DealFormValues) => {
      if (!selectedDeal) {
        return;
      }
      if (!mergeSources.length) {
        setMergeError('Выберите сделки для объединения.');
        return;
      }
      if (!isMergePreviewConfirmed) {
        setMergeError('Сначала выполните предпросмотр объединения.');
        return;
      }
      setIsMerging(true);
      setMergeError(null);
      try {
        await onMergeDeals(
          selectedDeal.id,
          mergeSources,
          finalDeal,
          mergePreviewSnapshotId || undefined,
        );
        setIsMergeModalOpen(false);
      } catch (err) {
        setMergeError(formatErrorMessage(err, 'Во время объединения произошла ошибка.'));
      } finally {
        setIsMerging(false);
      }
    },
    [isMergePreviewConfirmed, mergePreviewSnapshotId, mergeSources, onMergeDeals, selectedDeal],
  );

  const openMergeModal = useCallback(() => {
    setIsMergeModalOpen(true);
  }, []);

  const closeMergeModal = useCallback(() => {
    setIsMergeModalOpen(false);
    resetMergeForm();
  }, [resetMergeForm]);

  return {
    isMergeModalOpen,
    openMergeModal,
    closeMergeModal,
    mergeStep,
    setMergeStep,
    mergeSources,
    mergeError,
    mergeSearch,
    setMergeSearch,
    mergeList,
    mergeQuery,
    isMergeSearchActive,
    isMergeSearchLoading,
    isMerging,
    isMergePreviewLoading,
    mergePreviewWarnings,
    isMergePreviewConfirmed,
    mergeFinalDraft,
    toggleMergeSource,
    requestMergePreview,
    handleMergeSubmit,
  };
};
