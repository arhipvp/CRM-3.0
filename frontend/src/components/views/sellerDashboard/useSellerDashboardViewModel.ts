import { useMemo } from 'react';

import { formatDateRu } from '../../../utils/formatting';
import {
  type SellerDashboardFinancialSort,
  useSellerDashboardController,
} from '../hooks/useSellerDashboardController';
import {
  buildCalendarDays,
  buildExecutorSeries,
  buildFinancialMatrix,
  buildPaymentsSeries,
  type CalendarDay,
  type ChartPoint,
  type ExecutorPoint,
  type FinancialMatrixResult,
} from './dashboardCalculations';

type Dashboard = ReturnType<typeof useSellerDashboardController>['dashboard'];

export function useSellerDashboardViewModel({
  dashboard,
  financialSearch,
  hideZeroRowsCols,
  showOnlyWithData,
  financialSort,
}: {
  dashboard: Dashboard;
  financialSearch: string;
  hideZeroRowsCols: boolean;
  showOnlyWithData: boolean;
  financialSort: SellerDashboardFinancialSort;
}) {
  const periodLabel =
    dashboard?.rangeStart && dashboard?.rangeEnd
      ? `Период: ${formatDateRu(dashboard.rangeStart)} — ${formatDateRu(dashboard.rangeEnd)}`
      : 'Период';
  const policies = dashboard?.policies ?? [];
  const policyDrilldownHref = dashboard?.rangeStart
    ? `/policies?start_date_from=${encodeURIComponent(dashboard.rangeStart)}&start_date_to=${encodeURIComponent(dashboard.rangeEnd)}`
    : '/policies';
  const paymentsSeries = useMemo(() => {
    if (!dashboard?.rangeStart || !dashboard?.rangeEnd) return [] as ChartPoint[];
    return buildPaymentsSeries(dashboard.rangeStart, dashboard.rangeEnd, dashboard.paymentsByDay);
  }, [dashboard?.paymentsByDay, dashboard?.rangeEnd, dashboard?.rangeStart]);
  const executorSeries = useMemo(() => {
    if (!dashboard?.rangeStart || !dashboard?.rangeEnd) {
      return { executors: [], data: [] as ExecutorPoint[] };
    }
    return buildExecutorSeries(
      dashboard.rangeStart,
      dashboard.rangeEnd,
      dashboard.tasksCompletedByExecutor,
    );
  }, [dashboard?.rangeEnd, dashboard?.rangeStart, dashboard?.tasksCompletedByExecutor]);
  const policyExpirations = useMemo(
    () => dashboard?.policyExpirationsByDay ?? [],
    [dashboard?.policyExpirationsByDay],
  );
  const nextContacts = useMemo(
    () => dashboard?.nextContactsByDay ?? [],
    [dashboard?.nextContactsByDay],
  );
  const policyExpirationsMap = useMemo(
    () => new Map(policyExpirations.map((item) => [item.date, item.count])),
    [policyExpirations],
  );
  const nextContactsMap = useMemo(
    () => new Map(nextContacts.map((item) => [item.date, item.count])),
    [nextContacts],
  );
  const calendarDays = useMemo(() => {
    if (!dashboard?.rangeStart || !dashboard?.rangeEnd) return [] as CalendarDay[];
    return buildCalendarDays(
      dashboard.rangeStart,
      dashboard.rangeEnd,
      policyExpirationsMap,
      nextContactsMap,
    );
  }, [dashboard?.rangeEnd, dashboard?.rangeStart, policyExpirationsMap, nextContactsMap]);
  const calendarWeeks = useMemo(() => {
    const weeks: CalendarDay[][] = [];
    for (let index = 0; index < calendarDays.length; index += 7) {
      weeks.push(calendarDays.slice(index, index + 7));
    }
    return weeks;
  }, [calendarDays]);
  const financialTotals = dashboard?.financialTotals ?? {
    incomeTotal: '0',
    expenseTotal: '0',
    netTotal: '0',
    recordsCount: 0,
  };
  const financialMatrix = useMemo<FinancialMatrixResult>(
    () =>
      buildFinancialMatrix(
        dashboard?.financialByCompanyType ?? [],
        financialSearch,
        hideZeroRowsCols,
        showOnlyWithData,
        financialSort,
      ),
    [
      dashboard?.financialByCompanyType,
      financialSearch,
      hideZeroRowsCols,
      showOnlyWithData,
      financialSort,
    ],
  );
  return {
    calendarDays,
    calendarWeeks,
    executorSeries,
    financialMatrix,
    financialTotals,
    paymentsSeries,
    periodLabel,
    policies,
    policyDrilldownHref,
  };
}
