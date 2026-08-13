import { useCallback, useEffect, useMemo, useState } from 'react';

import { fetchDealsWithPagination } from '../../../api/deals';
import type { CommandPaletteItem } from '../../../components/common/modal/CommandPalette';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import type { Deal } from '../../../types';

interface UseTaskDealPickerParams {
  deals: Deal[];
  selectDealById: (dealId: string) => void;
  setQuickTaskDealId: React.Dispatch<React.SetStateAction<string | null>>;
}

export const useTaskDealPicker = ({
  deals,
  selectDealById,
  setQuickTaskDealId,
}: UseTaskDealPickerParams) => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [remoteDeals, setRemoteDeals] = useState<Deal[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  useEffect(() => {
    if (!isOpen || debouncedQuery.length < 2) {
      setRemoteDeals([]);
      setIsLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    void fetchDealsWithPagination(
      { search: debouncedQuery, page_size: 20 },
      { embed: 'none', signal: controller.signal },
    )
      .then((response) => {
        if (!controller.signal.aborted) setRemoteDeals(response.results);
      })
      .catch(() => {
        if (!controller.signal.aborted) setRemoteDeals([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [debouncedQuery, isOpen]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);

  const items = useMemo<CommandPaletteItem[]>(() => {
    const mergedDeals = [...remoteDeals, ...deals].filter(
      (deal, index, allDeals) => allDeals.findIndex((item) => item.id === deal.id) === index,
    );
    return mergedDeals
      .filter((deal) => !deal.deletedAt)
      .sort((left, right) => {
        const leftPinned = left.isPinned ? 1 : 0;
        const rightPinned = right.isPinned ? 1 : 0;
        if (leftPinned !== rightPinned) return rightPinned - leftPinned;
        return (right.createdAt ?? '').localeCompare(left.createdAt ?? '');
      })
      .map((deal) => ({
        id: `task-deal-${deal.id}`,
        title: deal.title,
        subtitle: deal.clientName ? `Клиент: ${deal.clientName}` : 'Выбор сделки для задачи',
        keywords: [deal.clientName ?? '', deal.executorName ?? ''],
        onSelect: () => {
          selectDealById(deal.id);
          setQuickTaskDealId(deal.id);
        },
      }));
  }, [deals, remoteDeals, selectDealById, setQuickTaskDealId]);

  return { close, isLoading, isOpen, items, open: () => setIsOpen(true), setQuery };
};
