import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchSellerDashboard } from '../../../api/policies';
import type { SellerDashboardResponse } from '../../../types';
import { formatErrorMessage } from '../../../utils/formatErrorMessage';

export type SellerDashboardFinancialSort =
  | 'net_desc'
  | 'net_asc'
  | 'income_desc'
  | 'expense_desc'
  | 'count_desc'
  | 'alpha';

export const useSellerDashboardController = () => {
  const [dashboard, setDashboard] = useState<SellerDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendarMode, setCalendarMode] = useState<'sum' | 'split'>('sum');
  const [financialSearch, setFinancialSearch] = useState('');
  const [financialSort, setFinancialSort] =
    useState<SellerDashboardFinancialSort>('net_desc');
  const [hideZeroRowsCols, setHideZeroRowsCols] = useState(true);
  const [showOnlyWithData, setShowOnlyWithData] = useState(true);
  const dashboardRequestRef = useRef(0);
  const dashboardAbortControllerRef = useRef<AbortController | null>(null);

  const loadDashboard = useCallback(async (override?: { startDate?: string; endDate?: string }) => {
    dashboardRequestRef.current += 1;
    const requestId = dashboardRequestRef.current;
    dashboardAbortControllerRef.current?.abort();
    const controller = new AbortController();
    dashboardAbortControllerRef.current = controller;
    setIsLoading(true);
    try {
      const payload = await fetchSellerDashboard(override, { signal: controller.signal });
      if (requestId !== dashboardRequestRef.current) {
        return;
      }
      setDashboard(payload);
      setError(null);
      setStartDate((prev) => prev || payload.rangeStart || '');
      setEndDate((prev) => prev || payload.rangeEnd || '');
    } catch (err) {
      if (controller.signal.aborted || requestId !== dashboardRequestRef.current) {
        return;
      }
      setDashboard(null);
      setError(formatErrorMessage(err, 'Ошибка загрузки дашборда.'));
    } finally {
      if (requestId === dashboardRequestRef.current) {
        dashboardAbortControllerRef.current = null;
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    return () => {
      dashboardAbortControllerRef.current?.abort();
    };
  }, []);

  const resetFinancialControls = useCallback(() => {
    setFinancialSearch('');
    setFinancialSort('net_desc');
    setHideZeroRowsCols(true);
    setShowOnlyWithData(true);
  }, []);

  const handleApply = useCallback(() => {
    void loadDashboard({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }, [endDate, loadDashboard, startDate]);

  return {
    calendarMode,
    dashboard,
    endDate,
    error,
    financialSearch,
    financialSort,
    handleApply,
    hideZeroRowsCols,
    isLoading,
    loadDashboard,
    resetFinancialControls,
    setCalendarMode,
    setEndDate,
    setFinancialSearch,
    setFinancialSort,
    setHideZeroRowsCols,
    setShowOnlyWithData,
    setStartDate,
    showOnlyWithData,
    startDate,
  };
};
