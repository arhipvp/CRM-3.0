import { useMemo, useState } from 'react';

import type { FilterParams } from '../api';

export const useDealFilters = () => {
  const [dealSearchInput, setDealSearchInput] = useState('');
  const [dealSearchApplied, setDealSearchApplied] = useState('');
  const [dealExecutorFilter, setDealExecutorFilterState] = useState('');
  const [dealShowDeleted, setDealShowDeletedState] = useState(false);
  const [dealShowClosed, setDealShowClosedState] = useState(false);
  const [dealOrdering, setDealOrderingState] = useState<string | undefined>(undefined);
  const [dealClientFilter, setDealClientFilter] = useState('');

  const applyDealSearch = (nextSearch?: string) => {
    const rawValue = nextSearch ?? dealSearchInput;
    setDealClientFilter('');
    if (nextSearch !== undefined) {
      setDealSearchInput(rawValue);
    }
    setDealSearchApplied(rawValue.trim());
  };

  const setDealExecutorFilter = (value: string) => {
    setDealClientFilter('');
    setDealExecutorFilterState(value);
  };

  const setDealShowDeleted = (value: boolean) => {
    setDealClientFilter('');
    setDealShowDeletedState(value);
  };

  const setDealShowClosed = (value: boolean) => {
    setDealClientFilter('');
    setDealShowClosedState(value);
  };

  const setDealOrdering = (value: string | undefined) => {
    setDealClientFilter('');
    setDealOrderingState(value);
  };

  const showClientDeals = (clientId: string) => {
    setDealSearchInput('');
    setDealSearchApplied('');
    setDealExecutorFilterState('');
    setDealShowDeletedState(false);
    setDealShowClosedState(true);
    setDealOrderingState(undefined);
    setDealClientFilter(clientId);
  };

  const resetDealFilters = () => {
    setDealSearchInput('');
    setDealSearchApplied('');
    setDealExecutorFilterState('');
    setDealShowDeletedState(false);
    setDealShowClosedState(false);
    setDealOrderingState(undefined);
    setDealClientFilter('');
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
    if (dealClientFilter) {
      result.client = dealClientFilter;
    }
    return result;
  }, [
    dealSearchApplied,
    dealExecutorFilter,
    dealShowDeleted,
    dealShowClosed,
    dealOrdering,
    dealClientFilter,
  ]);

  return {
    dealSearchInput,
    setDealSearchInput,
    applyDealSearch,
    dealExecutorFilter,
    setDealExecutorFilter,
    dealShowDeleted,
    setDealShowDeleted,
    dealShowClosed,
    setDealShowClosed,
    dealOrdering,
    setDealOrdering,
    showClientDeals,
    resetDealFilters,
    filters,
  };
};
