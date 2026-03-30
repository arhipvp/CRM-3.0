import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchStatementFinancialRecords } from '../../../../api';
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
  const requestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadStatementRecords = useCallback(async () => {
    if (viewMode !== 'statements' || !selectedStatementId) {
      setStatementRecords([]);
      setStatementRecordsError(null);
      setIsStatementRecordsLoading(false);
      return;
    }

    requestRef.current += 1;
    const requestId = requestRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStatementRecordsLoading(true);
    setStatementRecordsError(null);

    try {
      const records = await fetchStatementFinancialRecords(selectedStatementId, {
        signal: controller.signal,
      });
      if (requestRef.current !== requestId) {
        return;
      }
      setStatementRecords(records);
    } catch (error) {
      if (controller.signal.aborted || requestRef.current !== requestId) {
        return;
      }
      setStatementRecords([]);
      setStatementRecordsError(
        formatErrorMessage(error, 'Не удалось загрузить записи выбранной ведомости.'),
      );
    } finally {
      if (requestRef.current === requestId) {
        abortControllerRef.current = null;
        setIsStatementRecordsLoading(false);
      }
    }
  }, [selectedStatementId, viewMode]);

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
    loadStatementRecords,
  };
};
