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
          { page: nextPage, page_size: 100 },
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
    [selectedStatementId, viewMode],
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
  };
};
