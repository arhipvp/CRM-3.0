import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchStatementFinancialRecordsWithPagination } from '../../../../api';
import type { FinancialRecord } from '../../../../types';
import { formatErrorMessage } from '../../../../utils/formatErrorMessage';

interface UseStatementRecordsControllerArgs {
  selectedStatementId: string | null;
  viewMode: 'all' | 'statements';
}

export const useStatementRecordsController = ({
  selectedStatementId,
  viewMode,
}: UseStatementRecordsControllerArgs) => {
  const [statementRecords, setStatementRecords] = useState<FinancialRecord[]>([]);
  const [isStatementRecordsLoading, setIsStatementRecordsLoading] = useState(false);
  const [statementRecordsError, setStatementRecordsError] = useState<string | null>(null);
  const [statementRecordsHasMore, setStatementRecordsHasMore] = useState(false);
  const [isStatementRecordsLoadingMore, setIsStatementRecordsLoadingMore] = useState(false);
  const [amountOrdering, setAmountOrdering] = useState<'none' | 'asc' | 'desc'>('none');
  const [commentOrdering, setCommentOrdering] = useState<'none' | 'asc' | 'desc'>('none');
  const requestRef = useRef(0);
  const pageRef = useRef(1);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadStatementRecords = useCallback(
    async (mode: 'reset' | 'more' = 'reset') => {
      if (viewMode !== 'statements' || !selectedStatementId) {
        setStatementRecords([]);
        setStatementRecordsError(null);
        setIsStatementRecordsLoading(false);
        setStatementRecordsHasMore(false);
        return;
      }

      requestRef.current += 1;
      const requestId = requestRef.current;
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      if (mode === 'reset') {
        pageRef.current = 0;
        setStatementRecordsHasMore(false);
        setIsStatementRecordsLoading(true);
        setStatementRecordsError(null);
      } else {
        setIsStatementRecordsLoadingMore(true);
      }
      const nextPage = mode === 'more' ? pageRef.current + 1 : 1;

      try {
        const payload = await fetchStatementFinancialRecordsWithPagination(
          selectedStatementId,
          {
            page: nextPage,
            page_size: 50,
            ordering:
              commentOrdering !== 'none'
                ? commentOrdering === 'asc'
                  ? 'record_comment_sort,-date,-created_at'
                  : '-record_comment_sort,-date,-created_at'
                : amountOrdering === 'none'
                  ? '-date,-created_at'
                  : amountOrdering === 'asc'
                    ? 'amount,-date'
                    : '-amount,-date',
          },
          { signal: controller.signal },
        );
        if (requestRef.current !== requestId) {
          return;
        }
        pageRef.current = nextPage;
        setStatementRecordsHasMore(Boolean(payload.next));
        setStatementRecords((previous) =>
          mode === 'more' ? [...previous, ...payload.results] : payload.results,
        );
      } catch (error) {
        if (controller.signal.aborted || requestRef.current !== requestId) {
          return;
        }
        if (mode === 'reset') {
          setStatementRecords([]);
        }
        setStatementRecordsError(
          formatErrorMessage(error, 'Не удалось загрузить записи выбранной ведомости.'),
        );
      } finally {
        if (requestRef.current === requestId) {
          abortControllerRef.current = null;
          setIsStatementRecordsLoading(false);
          setIsStatementRecordsLoadingMore(false);
        }
      }
    },
    [amountOrdering, commentOrdering, selectedStatementId, viewMode],
  );

  useEffect(() => {
    void loadStatementRecords();
  }, [loadStatementRecords]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  return {
    statementRecords,
    isStatementRecordsLoading,
    statementRecordsError,
    statementRecordsHasMore,
    isStatementRecordsLoadingMore,
    loadStatementRecords,
    toggleAmountSort: () =>
      setAmountOrdering((value) => {
        const nextValue = value === 'none' ? 'asc' : value === 'asc' ? 'desc' : 'none';
        setCommentOrdering('none');
        return nextValue;
      }),
    getAmountSortIndicator: () =>
      amountOrdering === 'asc' ? '↑' : amountOrdering === 'desc' ? '↓' : '↕',
    getAmountSortLabel: () =>
      amountOrdering === 'asc'
        ? 'по возрастанию'
        : amountOrdering === 'desc'
          ? 'по убыванию'
          : 'не сортируется',
    toggleCommentSort: () =>
      setCommentOrdering((value) => {
        const nextValue = value === 'none' ? 'asc' : value === 'asc' ? 'desc' : 'none';
        setAmountOrdering('none');
        return nextValue;
      }),
    getCommentSortIndicator: () =>
      commentOrdering === 'asc' ? '↑' : commentOrdering === 'desc' ? '↓' : '↕',
    getCommentSortLabel: () =>
      commentOrdering === 'asc'
        ? 'по возрастанию'
        : commentOrdering === 'desc'
          ? 'по убыванию'
          : 'не сортируется',
  };
};
