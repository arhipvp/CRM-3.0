import { useMemo, useState } from 'react';

import type { FilterParams } from '../api';

export const useDealFilters = () => {
  const [dealSearchInput, setDealSearchInput] = useState('');
  const [dealSearchApplied, setDealSearchApplied] = useState('');
  const [dealExecutorFilter, setDealExecutorFilter] = useState('');
  const [dealShowDeleted, setDealShowDeleted] = useState(false);
  const [dealShowClosed, setDealShowClosed] = useState(false);
  const [dealOrdering, setDealOrdering] = useState<string | undefined>(undefined);

  const applyDealSearch = (nextSearch?: string) => {
    const rawValue = nextSearch ?? dealSearchInput;
    if (nextSearch !== undefined) {
      setDealSearchInput(rawValue);
    }
    setDealSearchApplied(rawValue.trim());
  };

  const clearDealSearchAndApply = () => {
    setDealSearchInput('');
    setDealSearchApplied('');
  };

  const filters = useMemo<FilterParams>(() => {
    const result: FilterParams = {};
    if (dealSearchApplied) {
      result.search = dealSearchApplied;
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
  }, [dealSearchApplied, dealExecutorFilter, dealShowDeleted, dealShowClosed, dealOrdering]);

  return {
    dealSearchInput,
    setDealSearchInput,
    applyDealSearch,
    clearDealSearchAndApply,
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
