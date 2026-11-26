import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

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
  const [amountOrdering, setAmountOrdering] = useState<'none' | 'asc' | 'desc'>('none');
  const [commentOrdering, setCommentOrdering] = useState<'none' | 'asc' | 'desc'>('none');
  const abortControllerRef = useRef<AbortController | null>(null);
  const queryRef = useRef<{ statementId: string; ordering: string } | null>(null);
  const statementId = viewMode === 'statements' ? selectedStatementId : null;
  const ordering =
    commentOrdering !== 'none'
      ? `${commentOrdering === 'desc' ? '-' : ''}record_comment_sort,-date,-created_at,id`
      : amountOrdering !== 'none'
        ? `${amountOrdering === 'desc' ? '-' : ''}amount,-date,id`
        : '-date,-created_at,id';

  useLayoutEffect(() => {
    queryRef.current = statementId ? { statementId, ordering } : null;
    return () => {
      queryRef.current = null;
      abortControllerRef.current?.abort();
    };
  }, [ordering, statementId]);

  const loadStatementRecords = useCallback(async () => {
    abortControllerRef.current?.abort();
    const query = queryRef.current;
    setStatementRecordsError(null);
    if (!query) {
      setStatementRecords([]);
      setIsStatementRecordsLoading(false);
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStatementRecordsLoading(true);

    const records: FinancialRecord[] = [];
    let page = 1;
    try {
      while (!controller.signal.aborted) {
        const payload = await fetchStatementFinancialRecordsWithPagination(
          query.statementId,
          { page, page_size: 200, ordering: query.ordering },
          { signal: controller.signal },
        );
        if (controller.signal.aborted) {
          return;
        }
        records.push(...payload.results);
        if (!payload.next) {
          setStatementRecords(records);
          break;
        }
        page += 1;
      }
    } catch (error) {
      if (controller.signal.aborted) {
        return;
      }
      setStatementRecords([]);
      setStatementRecordsError(
        formatErrorMessage(error, 'Не удалось загрузить записи выбранной ведомости.'),
      );
    } finally {
      if (!controller.signal.aborted) {
        abortControllerRef.current = null;
        setIsStatementRecordsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadStatementRecords();
  }, [loadStatementRecords, ordering, statementId]);

  return {
    statementRecords,
    isStatementRecordsLoading,
    statementRecordsError,
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
