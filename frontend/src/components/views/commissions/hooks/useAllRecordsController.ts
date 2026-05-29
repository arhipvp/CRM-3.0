import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FilterParams } from '../../../../api';
import { exportFinancialRecordsXlsx, fetchFinancialRecordsWithPagination } from '../../../../api';
import type { FinancialRecord, Statement } from '../../../../types';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import type { AllRecordsSortKey } from '../RecordsTable';

interface UseAllRecordsControllerArgs {
  viewMode: 'all' | 'statements';
  statementsById: Map<string, Statement>;
}

const QUERY_KEYS = {
  search: 'fr_search',
  showUnpaidPayments: 'fr_show_unpaid_payments',
  showStatementRecords: 'fr_show_statement_records',
  showPaidRecords: 'fr_show_paid_records',
  showZeroSaldo: 'fr_show_zero_saldo',
  recordType: 'fr_record_type',
  sortKey: 'fr_sort_key',
  sortDirection: 'fr_sort_direction',
  targetStatement: 'fr_target_statement',
  salesChannel: 'fr_sales_channel',
  scheduledFrom: 'fr_payment_date_from',
  scheduledTo: 'fr_payment_date_to',
} as const;

const QUERY_KEY_VALUES = Object.values(QUERY_KEYS);
const RECORD_TYPE_VALUES = new Set(['all', 'income', 'expense']);
const SORT_KEY_VALUES = new Set(['none', 'payment', 'paymentDate', 'saldo', 'comment', 'amount']);

const readQueryParams = () => {
  if (typeof window === 'undefined') {
    return new URLSearchParams();
  }
  return new URLSearchParams(window.location.search);
};

const readBooleanParam = (params: URLSearchParams, key: string, fallback: boolean) => {
  const value = params.get(key);
  if (value === null) {
    return fallback;
  }
  return value === '1';
};

const readRecordTypeParam = (params: URLSearchParams) => {
  const value = params.get(QUERY_KEYS.recordType) ?? 'all';
  return RECORD_TYPE_VALUES.has(value) ? (value as 'all' | 'income' | 'expense') : 'all';
};

const readSortKeyParam = (params: URLSearchParams): AllRecordsSortKey => {
  const value = params.get(QUERY_KEYS.sortKey) ?? 'none';
  return SORT_KEY_VALUES.has(value) ? (value as AllRecordsSortKey) : 'none';
};

const replaceAllRecordsQuery = (params: URLSearchParams) => {
  if (typeof window === 'undefined') {
    return;
  }
  const nextParams = new URLSearchParams(window.location.search);
  QUERY_KEY_VALUES.forEach((key) => nextParams.delete(key));
  params.forEach((value, key) => {
    if (value) {
      nextParams.set(key, value);
    }
  });
  const nextSearch = nextParams.toString();
  const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
  window.history.replaceState(window.history.state, '', nextUrl);
};

const saveBlob = (blob: Blob, filename: string) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

const buildFiltersCacheKey = (filters: FilterParams) =>
  JSON.stringify(
    Object.entries(filters)
      .filter(([, value]) => value !== undefined && value !== '')
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  );

export const useAllRecordsController = ({
  viewMode,
  statementsById,
}: UseAllRecordsControllerArgs) => {
  const initialQueryParamsRef = useRef(readQueryParams());
  const initialQueryParams = initialQueryParamsRef.current;
  const [allRecordsSearchInput, setAllRecordsSearchInput] = useState(
    () => initialQueryParams.get(QUERY_KEYS.search) ?? '',
  );
  const [allRecordsSearchApplied, setAllRecordsSearchApplied] = useState(
    () => initialQueryParams.get(QUERY_KEYS.search) ?? '',
  );
  const [showUnpaidPayments, setShowUnpaidPayments] = useState(() =>
    readBooleanParam(initialQueryParams, QUERY_KEYS.showUnpaidPayments, false),
  );
  const [showStatementRecords, setShowStatementRecords] = useState(() =>
    readBooleanParam(initialQueryParams, QUERY_KEYS.showStatementRecords, false),
  );
  const [showPaidRecords, setShowPaidRecords] = useState(() =>
    readBooleanParam(initialQueryParams, QUERY_KEYS.showPaidRecords, false),
  );
  const [showZeroSaldo, setShowZeroSaldo] = useState(() =>
    readBooleanParam(initialQueryParams, QUERY_KEYS.showZeroSaldo, false),
  );
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'income' | 'expense'>(() =>
    readRecordTypeParam(initialQueryParams),
  );
  const [allRecordsSortKey, setAllRecordsSortKey] = useState<AllRecordsSortKey>(() =>
    readSortKeyParam(initialQueryParams),
  );
  const [allRecordsSortDirection, setAllRecordsSortDirection] = useState<'asc' | 'desc'>(() =>
    initialQueryParams.get(QUERY_KEYS.sortDirection) === 'desc' ? 'desc' : 'asc',
  );
  const [targetStatementId, setTargetStatementId] = useState(
    () => initialQueryParams.get(QUERY_KEYS.targetStatement) ?? '',
  );
  const [salesChannelFilter, setSalesChannelFilter] = useState(
    () => initialQueryParams.get(QUERY_KEYS.salesChannel) ?? '',
  );
  const [paymentScheduledDateFrom, setPaymentScheduledDateFrom] = useState(
    () => initialQueryParams.get(QUERY_KEYS.scheduledFrom) ?? '',
  );
  const [paymentScheduledDateTo, setPaymentScheduledDateTo] = useState(
    () => initialQueryParams.get(QUERY_KEYS.scheduledTo) ?? '',
  );
  const [allRecords, setAllRecords] = useState<FinancialRecord[]>([]);
  const [isAllRecordsLoading, setIsAllRecordsLoading] = useState(false);
  const [isAllRecordsLoadingMore, setIsAllRecordsLoadingMore] = useState(false);
  const [isAllRecordsExporting, setIsAllRecordsExporting] = useState(false);
  const [allRecordsError, setAllRecordsError] = useState<string | null>(null);
  const [allRecordsExportError, setAllRecordsExportError] = useState<string | null>(null);
  const [allRecordsHasMore, setAllRecordsHasMore] = useState(false);
  const [allRecordsTotalCount, setAllRecordsTotalCount] = useState(0);
  const allRecordsPageRef = useRef(1);
  const allRecordsRequestRef = useRef(0);
  const allRecordsAbortControllerRef = useRef<AbortController | null>(null);
  const loadedFirstPageFiltersKeyRef = useRef<string | null>(null);

  const applyAllRecordsSearch = useCallback(
    (nextSearch?: string) => {
      const rawValue = nextSearch ?? allRecordsSearchInput;
      if (nextSearch !== undefined) {
        setAllRecordsSearchInput(rawValue);
      }
      setAllRecordsSearchApplied(rawValue.trim());
    },
    [allRecordsSearchInput],
  );

  const isRecordTypeLocked = useMemo(
    () => viewMode === 'all' && Boolean(targetStatementId),
    [targetStatementId, viewMode],
  );

  useEffect(() => {
    if (viewMode !== 'all') {
      return;
    }
    if (!targetStatementId) {
      setRecordTypeFilter('all');
      return;
    }
    const statement = statementsById.get(targetStatementId);
    if (!statement) {
      setRecordTypeFilter('all');
      return;
    }
    setRecordTypeFilter(statement.statementType === 'income' ? 'income' : 'expense');
  }, [statementsById, targetStatementId, viewMode]);

  const buildAllRecordsFilters = useCallback(() => {
    const filters: FilterParams = {};
    if (allRecordsSearchApplied) {
      filters.search = allRecordsSearchApplied;
    }
    if (!showUnpaidPayments) {
      filters.payment_paid = true;
    }
    if (!showStatementRecords) {
      filters.without_statement = true;
    }
    if (!showPaidRecords) {
      filters.unpaid_only = true;
    }
    if (!showZeroSaldo) {
      filters.paid_balance_not_zero = true;
    }
    if (recordTypeFilter !== 'all') {
      filters.record_type = recordTypeFilter;
    }
    if (salesChannelFilter) {
      filters.sales_channel = salesChannelFilter;
    }
    if (paymentScheduledDateFrom) {
      filters.payment_scheduled_date_from = paymentScheduledDateFrom;
    }
    if (paymentScheduledDateTo) {
      filters.payment_scheduled_date_to = paymentScheduledDateTo;
    }
    if (allRecordsSortKey !== 'none') {
      const directionPrefix = allRecordsSortDirection === 'desc' ? '-' : '';
      if (allRecordsSortKey === 'payment') {
        filters.ordering = `${directionPrefix}payment_is_paid,-payment_sort_date,-created_at`;
      } else if (allRecordsSortKey === 'paymentDate') {
        filters.ordering =
          allRecordsSortDirection === 'desc'
            ? 'payment_scheduled_date_is_null,-payment_scheduled_date,-created_at'
            : 'payment_scheduled_date_is_null,payment_scheduled_date,-created_at';
      } else if (allRecordsSortKey === 'saldo') {
        filters.ordering = `${directionPrefix}payment_paid_balance,-payment_sort_date,-created_at`;
      } else if (allRecordsSortKey === 'comment') {
        filters.ordering = `${directionPrefix}record_comment_sort,-payment_sort_date,-created_at`;
      } else if (allRecordsSortKey === 'amount') {
        filters.ordering = `${directionPrefix}amount,-payment_sort_date,-created_at`;
      }
    }
    return filters;
  }, [
    allRecordsSearchApplied,
    allRecordsSortDirection,
    allRecordsSortKey,
    paymentScheduledDateFrom,
    paymentScheduledDateTo,
    recordTypeFilter,
    salesChannelFilter,
    showPaidRecords,
    showStatementRecords,
    showUnpaidPayments,
    showZeroSaldo,
  ]);

  useEffect(() => {
    if (viewMode !== 'all') {
      return;
    }
    const params = new URLSearchParams();
    if (allRecordsSearchApplied) {
      params.set(QUERY_KEYS.search, allRecordsSearchApplied);
    }
    if (showUnpaidPayments) {
      params.set(QUERY_KEYS.showUnpaidPayments, '1');
    }
    if (showStatementRecords) {
      params.set(QUERY_KEYS.showStatementRecords, '1');
    }
    if (showPaidRecords) {
      params.set(QUERY_KEYS.showPaidRecords, '1');
    }
    if (showZeroSaldo) {
      params.set(QUERY_KEYS.showZeroSaldo, '1');
    }
    if (recordTypeFilter !== 'all') {
      params.set(QUERY_KEYS.recordType, recordTypeFilter);
    }
    if (allRecordsSortKey !== 'none') {
      params.set(QUERY_KEYS.sortKey, allRecordsSortKey);
      params.set(QUERY_KEYS.sortDirection, allRecordsSortDirection);
    }
    if (targetStatementId) {
      params.set(QUERY_KEYS.targetStatement, targetStatementId);
    }
    if (salesChannelFilter) {
      params.set(QUERY_KEYS.salesChannel, salesChannelFilter);
    }
    if (paymentScheduledDateFrom) {
      params.set(QUERY_KEYS.scheduledFrom, paymentScheduledDateFrom);
    }
    if (paymentScheduledDateTo) {
      params.set(QUERY_KEYS.scheduledTo, paymentScheduledDateTo);
    }
    replaceAllRecordsQuery(params);
  }, [
    allRecordsSearchApplied,
    allRecordsSortDirection,
    allRecordsSortKey,
    paymentScheduledDateFrom,
    paymentScheduledDateTo,
    recordTypeFilter,
    salesChannelFilter,
    showPaidRecords,
    showStatementRecords,
    showUnpaidPayments,
    showZeroSaldo,
    targetStatementId,
    viewMode,
  ]);

  const activeAllRecordsFilterCount = useMemo(() => {
    return [
      Boolean(allRecordsSearchApplied),
      showUnpaidPayments,
      showStatementRecords,
      showPaidRecords,
      showZeroSaldo,
      recordTypeFilter !== 'all',
      Boolean(targetStatementId),
      Boolean(salesChannelFilter),
      Boolean(paymentScheduledDateFrom),
      Boolean(paymentScheduledDateTo),
    ].filter(Boolean).length;
  }, [
    allRecordsSearchApplied,
    paymentScheduledDateFrom,
    paymentScheduledDateTo,
    recordTypeFilter,
    salesChannelFilter,
    showPaidRecords,
    showStatementRecords,
    showUnpaidPayments,
    showZeroSaldo,
    targetStatementId,
  ]);

  const canResetAllRecordsFilters = useMemo(
    () =>
      activeAllRecordsFilterCount > 0 ||
      allRecordsSortKey !== 'none' ||
      Boolean(allRecordsSearchInput),
    [activeAllRecordsFilterCount, allRecordsSearchInput, allRecordsSortKey],
  );

  const resetAllRecordsFilters = useCallback(() => {
    setAllRecordsSearchInput('');
    setAllRecordsSearchApplied('');
    setShowUnpaidPayments(false);
    setShowStatementRecords(false);
    setShowPaidRecords(false);
    setShowZeroSaldo(false);
    setRecordTypeFilter('all');
    setAllRecordsSortKey('none');
    setAllRecordsSortDirection('asc');
    setTargetStatementId('');
    setSalesChannelFilter('');
    setPaymentScheduledDateFrom('');
    setPaymentScheduledDateTo('');
  }, []);

  const loadAllRecords = useCallback(
    async (mode: 'reset' | 'more') => {
      allRecordsRequestRef.current += 1;
      const requestId = allRecordsRequestRef.current;
      allRecordsAbortControllerRef.current?.abort();
      const controller = new AbortController();
      allRecordsAbortControllerRef.current = controller;
      const filters = buildAllRecordsFilters();
      const filtersKey = buildFiltersCacheKey(filters);
      const nextPage = mode === 'more' ? allRecordsPageRef.current + 1 : 1;
      if (mode === 'reset') {
        setIsAllRecordsLoading(true);
        setAllRecordsError(null);
      } else {
        setIsAllRecordsLoadingMore(true);
      }

      try {
        const payload = await fetchFinancialRecordsWithPagination(
          {
            ...filters,
            page: nextPage,
          },
          { signal: controller.signal },
        );
        if (requestId !== allRecordsRequestRef.current) {
          return;
        }
        setAllRecordsTotalCount(payload.count || 0);
        setAllRecordsHasMore(Boolean(payload.next));
        allRecordsPageRef.current = nextPage;
        if (mode === 'reset') {
          loadedFirstPageFiltersKeyRef.current = filtersKey;
        }
        setAllRecords((prev) =>
          mode === 'more' ? [...prev, ...payload.results] : payload.results,
        );
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        if (requestId !== allRecordsRequestRef.current) {
          return;
        }
        if (mode === 'reset') {
          setAllRecords([]);
        }
        setAllRecordsHasMore(false);
        setAllRecordsError(formatErrorMessage(error, 'Не удалось загрузить финансовые записи.'));
      } finally {
        if (requestId === allRecordsRequestRef.current) {
          allRecordsAbortControllerRef.current = null;
          setIsAllRecordsLoading(false);
          setIsAllRecordsLoadingMore(false);
        }
      }
    },
    [buildAllRecordsFilters],
  );

  const exportAllRecords = useCallback(async () => {
    setIsAllRecordsExporting(true);
    setAllRecordsExportError(null);
    try {
      const { blob, filename } = await exportFinancialRecordsXlsx(buildAllRecordsFilters());
      saveBlob(blob, filename || 'financial_records.xlsx');
    } catch (error) {
      setAllRecordsExportError(
        formatErrorMessage(error, 'Не удалось выгрузить финансовые записи.'),
      );
    } finally {
      setIsAllRecordsExporting(false);
    }
  }, [buildAllRecordsFilters]);

  useEffect(() => {
    if (viewMode !== 'all') {
      return;
    }
    const filtersKey = buildFiltersCacheKey(buildAllRecordsFilters());
    if (loadedFirstPageFiltersKeyRef.current === filtersKey) {
      return;
    }
    void loadAllRecords('reset');
  }, [buildAllRecordsFilters, loadAllRecords, viewMode]);

  useEffect(() => {
    return () => {
      allRecordsAbortControllerRef.current?.abort();
    };
  }, []);

  const toggleAllRecordsSort = useCallback(
    (key: AllRecordsSortKey) => {
      if (viewMode !== 'all') {
        return;
      }
      if (allRecordsSortKey !== key) {
        setAllRecordsSortKey(key);
        setAllRecordsSortDirection('asc');
        return;
      }
      if (allRecordsSortDirection === 'asc') {
        setAllRecordsSortDirection('desc');
        return;
      }
      setAllRecordsSortKey('none');
      setAllRecordsSortDirection('asc');
    },
    [allRecordsSortDirection, allRecordsSortKey, viewMode],
  );

  const getAllRecordsSortIndicator = useCallback(
    (key: AllRecordsSortKey) => {
      if (viewMode !== 'all') {
        return '';
      }
      if (allRecordsSortKey !== key) {
        return '↕';
      }
      return allRecordsSortDirection === 'asc' ? '↑' : '↓';
    },
    [allRecordsSortDirection, allRecordsSortKey, viewMode],
  );

  const getAllRecordsSortLabel = useCallback(
    (key: AllRecordsSortKey) => {
      if (viewMode !== 'all') {
        return '';
      }
      if (allRecordsSortKey !== key) {
        return 'не сортируется';
      }
      return allRecordsSortDirection === 'asc' ? 'по возрастанию' : 'по убыванию';
    },
    [allRecordsSortDirection, allRecordsSortKey, viewMode],
  );

  return {
    allRecordsSearchInput,
    setAllRecordsSearchInput,
    allRecordsSearchApplied,
    applyAllRecordsSearch,
    showUnpaidPayments,
    setShowUnpaidPayments,
    showStatementRecords,
    setShowStatementRecords,
    showPaidRecords,
    setShowPaidRecords,
    showZeroSaldo,
    setShowZeroSaldo,
    recordTypeFilter,
    setRecordTypeFilter,
    targetStatementId,
    setTargetStatementId,
    salesChannelFilter,
    setSalesChannelFilter,
    paymentScheduledDateFrom,
    setPaymentScheduledDateFrom,
    paymentScheduledDateTo,
    setPaymentScheduledDateTo,
    activeAllRecordsFilterCount,
    canResetAllRecordsFilters,
    resetAllRecordsFilters,
    isRecordTypeLocked,
    allRecords,
    isAllRecordsLoading,
    isAllRecordsLoadingMore,
    isAllRecordsExporting,
    allRecordsError,
    allRecordsExportError,
    allRecordsHasMore,
    allRecordsTotalCount,
    loadAllRecords,
    exportAllRecords,
    toggleAllRecordsSort,
    getAllRecordsSortIndicator,
    getAllRecordsSortLabel,
  };
};
