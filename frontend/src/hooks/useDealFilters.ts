import { useMemo, useState } from 'react';

import type { FilterParams } from '../api';

export const useDealFilters = () => {
  const [dealSearch, setDealSearch] = useState('');
  const [dealExecutorFilter, setDealExecutorFilter] = useState('');
  const [dealShowDeleted, setDealShowDeleted] = useState(false);
  const [dealShowClosed, setDealShowClosed] = useState(false);
  const [dealOrdering, setDealOrdering] = useState<string | undefined>(undefined);

  const filters = useMemo<FilterParams>(() => {
    const result: FilterParams = {};
    const trimmedSearch = dealSearch.trim();
    if (trimmedSearch) {
      result.search = trimmedSearch;
    }
    if (dealExecutorFilter) {
      result.executor = dealExecutorFilter;
    }
    if (dealShowDeleted) {
      result.show_deleted = true;
    }
    if (dealShowClosed) {
      result.show_closed = true;
    }
    if (dealOrdering) {
      result.ordering = dealOrdering;
    }
    return result;
  }, [dealSearch, dealExecutorFilter, dealShowDeleted, dealShowClosed, dealOrdering]);

  return {
    dealSearch,
    setDealSearch,
    dealExecutorFilter,
    setDealExecutorFilter,
    dealShowDeleted,
    setDealShowDeleted,
    dealShowClosed,
    setDealShowClosed,
    dealOrdering,
    setDealOrdering,
    filters,
  };
};
