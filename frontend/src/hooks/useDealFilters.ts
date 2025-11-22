import { useMemo, useState } from 'react';

import type { FilterParams } from '../api';

export const useDealFilters = () => {
  const [dealSearch, setDealSearch] = useState('');
  const [dealExecutorFilter, setDealExecutorFilter] = useState('');
  const [dealSourceFilter, setDealSourceFilter] = useState('');
  const [dealExpectedCloseFrom, setDealExpectedCloseFrom] = useState('');
  const [dealExpectedCloseTo, setDealExpectedCloseTo] = useState('');
  const [dealShowDeleted, setDealShowDeleted] = useState(false);

  const filters = useMemo<FilterParams>(() => {
    const result: FilterParams = { ordering: 'next_contact_date' };
    const trimmedSearch = dealSearch.trim();
    if (trimmedSearch) {
      result.search = trimmedSearch;
    }
    if (dealExecutorFilter) {
      result.executor = dealExecutorFilter;
    }
    const trimmedSource = dealSourceFilter.trim();
    if (trimmedSource) {
      result.source = trimmedSource;
    }
    if (dealExpectedCloseFrom) {
      result['expected_close_after'] = dealExpectedCloseFrom;
    }
    if (dealExpectedCloseTo) {
      result['expected_close_before'] = dealExpectedCloseTo;
    }
    if (dealShowDeleted) {
      result.show_deleted = true;
    }
    return result;
  }, [
    dealSearch,
    dealExecutorFilter,
    dealSourceFilter,
    dealExpectedCloseFrom,
    dealExpectedCloseTo,
    dealShowDeleted,
  ]);

  return {
    dealSearch,
    setDealSearch,
    dealExecutorFilter,
    setDealExecutorFilter,
    dealSourceFilter,
    setDealSourceFilter,
    dealExpectedCloseFrom,
    setDealExpectedCloseFrom,
    dealExpectedCloseTo,
    setDealExpectedCloseTo,
    dealShowDeleted,
    setDealShowDeleted,
    filters,
  };
};
