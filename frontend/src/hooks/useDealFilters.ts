import { useMemo, useState } from 'react';

import type { FilterParams } from '../api';

export const useDealFilters = () => {
  const [dealSearch, setDealSearch] = useState('');
  const [dealExecutorFilter, setDealExecutorFilter] = useState('');
  const [dealShowDeleted, setDealShowDeleted] = useState(false);
  const [dealShowClosed, setDealShowClosed] = useState(false);

  const filters = useMemo<FilterParams>(() => {
    const result: FilterParams = { ordering: 'next_contact_date' };
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
    return result;
  }, [dealSearch, dealExecutorFilter, dealShowDeleted, dealShowClosed]);

  return {
    dealSearch,
    setDealSearch,
    dealExecutorFilter,
    setDealExecutorFilter,
    dealShowDeleted,
    setDealShowDeleted,
    dealShowClosed,
    setDealShowClosed,
    filters,
  };
};
