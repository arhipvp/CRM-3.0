import { useCallback, useEffect, useMemo, useState } from 'react';

import type { Client, Deal, User } from '../../../../types';
import { fetchDeals } from '../../../../api';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';

interface UseDealMergeParams {
  deals: Deal[];
  clients: Client[];
  selectedDeal: Deal | null;
  currentUser: User | null;
  onMergeDeals: (
    targetDealId: string,
    sourceDealIds: string[],
    resultingClientId?: string,
  ) => Promise<void>;
  debounceDelay?: number;
}

export const useDealMerge = ({
  deals,
  clients,
  selectedDeal,
  currentUser,
  onMergeDeals,
  debounceDelay = 300,
}: UseDealMergeParams) => {
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [mergeSources, setMergeSources] = useState<string[]>([]);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeSearch, setMergeSearch] = useState('');
  const [mergeSearchResults, setMergeSearchResults] = useState<Deal[]>([]);
  const [isMergeSearchLoading, setIsMergeSearchLoading] = useState(false);
  const [mergeResultingClientId, setMergeResultingClientId] = useState<string | undefined>(
    undefined,
  );

  const mergeCandidates = useMemo(() => {
    if (!selectedDeal) {
      return [];
    }
    return deals.filter((deal: Deal) => deal.id !== selectedDeal.id && !deal.deletedAt);
  }, [deals, selectedDeal]);

  const mergeClientOptions = useMemo(() => {
    if (!selectedDeal) {
      return [];
    }
    const ids = new Set<string>();
    if (selectedDeal.clientId) {
      ids.add(selectedDeal.clientId);
    }
    mergeCandidates.forEach((deal: Deal) => {
      if (deal.clientId) {
        ids.add(deal.clientId);
      }
    });
    return Array.from(ids).map((clientId) => {
      const client = clients.find((entity) => entity.id === clientId);
      const fallbackName =
        mergeCandidates.find((deal: Deal) => deal.clientId === clientId)?.clientName ||
        selectedDeal.clientName;
      const name = client?.name || fallbackName || '—';
      return { id: clientId, name };
    });
  }, [clients, mergeCandidates, selectedDeal]);

  useEffect(() => {
    if (!isMergeModalOpen) {
      setMergeResultingClientId(undefined);
      return;
    }
    if (!mergeClientOptions.length) {
      setMergeResultingClientId(undefined);
      return;
    }
    setMergeResultingClientId((prev) => {
      if (prev && mergeClientOptions.some((option) => option.id === prev)) {
        return prev;
      }
      return mergeClientOptions[0].id;
    });
  }, [isMergeModalOpen, mergeClientOptions]);

  const resetMergeForm = useCallback(() => {
    setMergeSources([]);
    setMergeError(null);
    setMergeSearch('');
    setMergeSearchResults([]);
    setIsMergeSearchLoading(false);
    setMergeResultingClientId(undefined);
  }, []);

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
            (deal) => deal.id !== selectedDeal?.id && !deal.deletedAt,
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
  }, [currentUser?.id, mergeQuery, selectedDeal?.id, debounceDelay]);

  const toggleMergeSource = useCallback((dealId: string) => {
    setMergeSources((prev) =>
      prev.includes(dealId) ? prev.filter((id) => id !== dealId) : [...prev, dealId],
    );
    setMergeError(null);
  }, []);

  const handleMergeSubmit = useCallback(async () => {
    if (!selectedDeal) {
      return;
    }
    if (!mergeSources.length) {
      setMergeError('Выберите сделки для объединения.');
      return;
    }
    if (mergeClientOptions.length && !mergeResultingClientId) {
      setMergeError('Выберите клиента для объединённой сделки.');
      return;
    }
    setIsMerging(true);
    setMergeError(null);
    try {
      await onMergeDeals(selectedDeal.id, mergeSources, mergeResultingClientId);
      setIsMergeModalOpen(false);
    } catch (err) {
      setMergeError(formatErrorMessage(err, 'Во время объединения произошла ошибка.'));
    } finally {
      setIsMerging(false);
    }
  }, [mergeClientOptions.length, mergeResultingClientId, mergeSources, onMergeDeals, selectedDeal]);

  const openMergeModal = useCallback(() => {
    setIsMergeModalOpen(true);
  }, []);

  const closeMergeModal = useCallback(() => {
    setIsMergeModalOpen(false);
  }, []);

  return {
    isMergeModalOpen,
    openMergeModal,
    closeMergeModal,
    mergeSources,
    mergeError,
    mergeSearch,
    setMergeSearch,
    mergeList,
    mergeQuery,
    isMergeSearchActive,
    mergeSearchResults,
    isMergeSearchLoading,
    isMerging,
    toggleMergeSource,
    handleMergeSubmit,
  };
};
