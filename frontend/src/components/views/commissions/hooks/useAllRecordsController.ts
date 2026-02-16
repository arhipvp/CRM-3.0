import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { FilterParams } from '../../../../api';
import { fetchFinancialRecordsWithPagination } from '../../../../api';
import type { FinancialRecord, Statement } from '../../../../types';
import { useDebouncedValue } from '../../../../hooks/useDebouncedValue';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';
import type { AllRecordsSortKey } from '../RecordsTable';

interface UseAllRecordsControllerArgs {
  viewMode: 'all' | 'statements';
  statementsById: Map<string, Statement>;
}

export const useAllRecordsController = ({
  viewMode,
  statementsById,
}: UseAllRecordsControllerArgs) => {
  const [allRecordsSearch, setAllRecordsSearch] = useState('');
  const [showUnpaidPayments, setShowUnpaidPayments] = useState(false);
  const [showStatementRecords, setShowStatementRecords] = useState(false);
  const [showPaidRecords, setShowPaidRecords] = useState(false);
  const [showZeroSaldo, setShowZeroSaldo] = useState(false);
  const [recordTypeFilter, setRecordTypeFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [allRecordsSortKey, setAllRecordsSortKey] = useState<AllRecordsSortKey>('none');
  const [allRecordsSortDirection, setAllRecordsSortDirection] = useState<'asc' | 'desc'>('asc');
  const [targetStatementId, setTargetStatementId] = useState('');
  const [allRecords, setAllRecords] = useState<FinancialRecord[]>([]);
  const [isAllRecordsLoading, setIsAllRecordsLoading] = useState(false);
  const [isAllRecordsLoadingMore, setIsAllRecordsLoadingMore] = useState(false);
  const [allRecordsError, setAllRecordsError] = useState<string | null>(null);
  const [allRecordsHasMore, setAllRecordsHasMore] = useState(false);
  const [allRecordsTotalCount, setAllRecordsTotalCount] = useState(0);
  const allRecordsPageRef = useRef(1);
  const allRecordsRequestRef = useRef(0);

  const debouncedSearch = useDebouncedValue(allRecordsSearch.trim(), 450);
  // Поиск должен фильтровать даже по коротким строкам; иначе при "не нашлось"
  // пользователь видит полный список, что выглядит как баг.
  const effectiveSearch = debouncedSearch;

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

  const loadAllRecords = useCallback(
    async (mode: 'reset' | 'more') => {
      allRecordsRequestRef.current += 1;
      const requestId = allRecordsRequestRef.current;
      const filters: FilterParams = {};
      if (effectiveSearch) {
        filters.search = effectiveSearch;
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
      if (allRecordsSortKey !== 'none') {
        const directionPrefix = allRecordsSortDirection === 'desc' ? '-' : '';
        if (allRecordsSortKey === 'payment') {
          filters.ordering = `${directionPrefix}payment_is_paid,-payment_sort_date,-created_at`;
        } else if (allRecordsSortKey === 'saldo') {
          filters.ordering = `${directionPrefix}payment_paid_balance,-payment_sort_date,-created_at`;
        } else if (allRecordsSortKey === 'comment') {
          filters.ordering = `${directionPrefix}record_comment_sort,-payment_sort_date,-created_at`;
        } else if (allRecordsSortKey === 'amount') {
          filters.ordering = `${directionPrefix}amount,-payment_sort_date,-created_at`;
        }
      }
      const nextPage = mode === 'more' ? allRecordsPageRef.current + 1 : 1;
      if (mode === 'reset') {
        setIsAllRecordsLoading(true);
        setAllRecordsError(null);
      } else {
        setIsAllRecordsLoadingMore(true);
      }

      try {
        const payload = await fetchFinancialRecordsWithPagination({
          ...filters,
          page: nextPage,
        });
        if (requestId !== allRecordsRequestRef.current) {
          return;
        }
        setAllRecordsTotalCount(payload.count || 0);
        setAllRecordsHasMore(Boolean(payload.next));
        allRecordsPageRef.current = nextPage;
        setAllRecords((prev) =>
          mode === 'more' ? [...prev, ...payload.results] : payload.results,
        );
      } catch (error) {
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
          setIsAllRecordsLoading(false);
          setIsAllRecordsLoadingMore(false);
        }
      }
    },
    [
      effectiveSearch,
      allRecordsSortDirection,
      allRecordsSortKey,
      recordTypeFilter,
      showPaidRecords,
      showZeroSaldo,
      showStatementRecords,
      showUnpaidPayments,
    ],
  );

  useEffect(() => {
    if (viewMode !== 'all') {
      return;
    }
    void loadAllRecords('reset');
  }, [loadAllRecords, viewMode]);

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
    allRecordsSearch,
    setAllRecordsSearch,
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
    isRecordTypeLocked,
    allRecords,
    isAllRecordsLoading,
    isAllRecordsLoadingMore,
    allRecordsError,
    allRecordsHasMore,
    allRecordsTotalCount,
    loadAllRecords,
    toggleAllRecordsSort,
    getAllRecordsSortIndicator,
    getAllRecordsSortLabel,
  };
};
