import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSellerDashboard } from '../../api/policies';
import type {
  SellerDashboardFinancialByCompanyTypeRow,
  SellerDashboardPaymentsByDay,
  SellerDashboardResponse,
  SellerDashboardTasksByExecutor,
} from '../../types';
import { formatCurrencyRu, formatDateRu, RU_LOCALE } from '../../utils/formatting';
import { BTN_SM_PRIMARY } from '../common/buttonStyles';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

const CHART_HEIGHT = 190;
const CHART_PADDING = 28;
const TOOLTIP_OFFSET = 12;
const MIN_CHART_WIDTH = 320;
const EXECUTOR_COLORS = [
  '#0284c7',
  '#0ea5e9',
  '#14b8a6',
  '#f97316',
  '#a855f7',
  '#e11d48',
  '#22c55e',
];

type ChartPoint = {
  date: string;
  value: number;
};

type ExecutorSeries = {
  id: string;
  name: string;
  color: string;
};

type ExecutorPoint = {
  date: string;
  totals: Record<string, number>;
};

type CalendarDay = {
  date: string;
  day: number;
  isInRange: boolean;
  isWeekend: boolean;
  policyExpirations: number;
  nextContacts: number;
};

type FinancialCell = {
  income: number;
  expense: number;
  net: number;
  count: number;
};

type FinancialCompanyRow = {
  companyKey: string;
  companyName: string;
  cells: Map<string, FinancialCell>;
  totals: FinancialCell;
};

type FinancialTypeColumn = {
  typeKey: string;
  typeName: string;
};

const parseNumber = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseIsoDate = (value: string) => {
  const parts = value.split('-').map((part) => Number(part));
  if (parts.length !== 3) {
    return null;
  }
  const [year, month, day] = parts;
  if (!year || !month || !day) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
};

const formatIsoDate = (date: Date) => date.toISOString().slice(0, 10);

const addUtcDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const weekdayIndex = (date: Date) => (date.getUTCDay() + 6) % 7;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));
const UNKNOWN_GROUP_LABEL = 'Не указано';

const createEmptyFinancialCell = (): FinancialCell => ({
  income: 0,
  expense: 0,
  net: 0,
  count: 0,
});

const buildFinancialCellFromRow = (
  row: SellerDashboardFinancialByCompanyTypeRow,
): FinancialCell => ({
  income: parseNumber(row.incomeTotal),
  expense: parseNumber(row.expenseTotal),
  net: parseNumber(row.netTotal),
  count: Number(row.recordsCount ?? 0),
});

const appendFinancialCell = (target: FinancialCell, cell: FinancialCell) => {
  target.income += cell.income;
  target.expense += cell.expense;
  target.net += cell.net;
  target.count += cell.count;
};

const compareFinancialGroupLabels = (left: string, right: string) => {
  const leftUnknown = left === UNKNOWN_GROUP_LABEL;
  const rightUnknown = right === UNKNOWN_GROUP_LABEL;
  if (leftUnknown && !rightUnknown) {
    return 1;
  }
  if (!leftUnknown && rightUnknown) {
    return -1;
  }
  return left.localeCompare(right, RU_LOCALE);
};

const resolveChartWidth = (container: HTMLDivElement | null) => {
  if (!container) {
    return MIN_CHART_WIDTH;
  }
  const width = Math.round(container.getBoundingClientRect().width || 0);
  return Math.max(width, MIN_CHART_WIDTH);
};

const formatShortDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(RU_LOCALE, { day: '2-digit', month: 'short' });
};

const buildDateRange = (start: string, end: string) => {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return [] as string[];
  }
  const days = [] as string[];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const buildCalendarDays = (
  rangeStart: string,
  rangeEnd: string,
  policyExpirations: Map<string, number>,
  nextContacts: Map<string, number>,
): CalendarDay[] => {
  const start = parseIsoDate(rangeStart);
  const end = parseIsoDate(rangeEnd);
  if (!start || !end || start > end) {
    return [];
  }
  const calendarStart = addUtcDays(start, -weekdayIndex(start));
  const calendarEnd = addUtcDays(end, 6 - weekdayIndex(end));
  const days: CalendarDay[] = [];
  let cursor = calendarStart;
  while (cursor <= calendarEnd) {
    const iso = formatIsoDate(cursor);
    const isInRange = cursor >= start && cursor <= end;
    const day = cursor.getUTCDate();
    const isWeekend = [5, 6].includes(weekdayIndex(cursor));
    days.push({
      date: iso,
      day,
      isInRange,
      isWeekend,
      policyExpirations: policyExpirations.get(iso) ?? 0,
      nextContacts: nextContacts.get(iso) ?? 0,
    });
    cursor = addUtcDays(cursor, 1);
  }
  return days;
};

const buildPaymentsSeries = (
  rangeStart: string,
  rangeEnd: string,
  items: SellerDashboardPaymentsByDay[],
): ChartPoint[] => {
  const range = buildDateRange(rangeStart, rangeEnd);
  const map = new Map(items.map((item) => [item.date, parseNumber(item.total)]));
  return range.map((date) => ({ date, value: map.get(date) ?? 0 }));
};

const buildExecutorSeries = (
  rangeStart: string,
  rangeEnd: string,
  items: SellerDashboardTasksByExecutor[],
) => {
  const range = buildDateRange(rangeStart, rangeEnd);
  const executors: ExecutorSeries[] = [];
  const executorMap = new Map<string, ExecutorSeries>();

  items.forEach((item) => {
    const id = item.executorId ?? 'unknown';
    if (!executorMap.has(id)) {
      const color = EXECUTOR_COLORS[executorMap.size % EXECUTOR_COLORS.length];
      const entry = { id, name: item.executorName || 'Неизвестный', color };
      executorMap.set(id, entry);
      executors.push(entry);
    }
  });

  const data = range.map((date) => {
    const totals: Record<string, number> = {};
    executors.forEach((executor) => {
      totals[executor.id] = 0;
    });
    return { date, totals };
  });

  const indexByDate = new Map(data.map((item, index) => [item.date, index]));
  items.forEach((item) => {
    const id = item.executorId ?? 'unknown';
    const index = indexByDate.get(item.date);
    if (index === undefined) {
      return;
    }
    if (!(id in data[index].totals)) {
      data[index].totals[id] = 0;
    }
    data[index].totals[id] += item.count;
  });

  return { executors, data };
};

const ChartTooltip: React.FC<{ left: number; top: number; children: React.ReactNode }> = ({
  left,
  top,
  children,
}) => (
  <div
    className="absolute z-10 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-md"
    style={{ left, top }}
  >
    {children}
  </div>
);

const useResponsiveChartWidth = (containerRef: React.RefObject<HTMLDivElement | null>) => {
  const [width, setWidth] = useState(MIN_CHART_WIDTH);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    setWidth(resolveChartWidth(container));

    if (typeof ResizeObserver === 'undefined') {
      const handleResize = () => setWidth(resolveChartWidth(containerRef.current));
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }

    const observer = new ResizeObserver(() => {
      setWidth(resolveChartWidth(containerRef.current));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [containerRef]);

  return width;
};

const LineChart: React.FC<{ points: ChartPoint[]; formatter: (value: number) => string }> = ({
  points,
  formatter,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartWidth = useResponsiveChartWidth(containerRef);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!points.length) {
    return (
      <div className="app-panel-muted flex h-[190px] items-center justify-center text-sm text-slate-500">
        Нет данных для графика
      </div>
    );
  }

  const maxValue = Math.max(...points.map((point) => point.value), 0);
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const range = maxValue - minValue || 1;

  const width = chartWidth;
  const height = CHART_HEIGHT;
  const plotWidth = width - CHART_PADDING * 2;
  const plotHeight = height - CHART_PADDING * 2;

  const toX = (index: number) => CHART_PADDING + (index / (points.length - 1 || 1)) * plotWidth;
  const toY = (value: number) =>
    CHART_PADDING + plotHeight - ((value - minValue) / range) * plotHeight;

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(index)} ${toY(point.value)}`)
    .join(' ');

  const areaPath = `${path} L ${toX(points.length - 1)} ${CHART_PADDING + plotHeight} L ${toX(0)} ${
    CHART_PADDING + plotHeight
  } Z`;

  const startLabel = formatShortDate(points[0].date);
  const endLabel = formatShortDate(points[points.length - 1].date);
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const tooltipMaxLeft = Math.max(width - 220, TOOLTIP_OFFSET);

  return (
    <div
      className="relative"
      ref={containerRef}
      onMouseLeave={() => setHoverIndex(null)}
      onMouseMove={(event) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) {
          return;
        }
        const x = event.clientX - rect.left - CHART_PADDING;
        const ratio = Math.min(Math.max(x / plotWidth, 0), 1);
        const index = Math.round(ratio * (points.length - 1));
        setHoverIndex(index);
      }}
    >
      <div className="app-panel-muted p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          <defs>
            <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#lineFill)" />
          <path d={path} fill="none" stroke="#0284c7" strokeWidth="3" />
          {hoverPoint && (
            <circle
              cx={toX(hoverIndex ?? 0)}
              cy={toY(hoverPoint.value)}
              r={5}
              fill="#0ea5e9"
              stroke="#fff"
              strokeWidth={2}
            />
          )}
        </svg>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      </div>
      {hoverPoint && (
        <ChartTooltip
          left={clamp(toX(hoverIndex ?? 0) + TOOLTIP_OFFSET, TOOLTIP_OFFSET, tooltipMaxLeft)}
          top={CHART_PADDING}
        >
          <div className="font-semibold text-slate-900">{formatShortDate(hoverPoint.date)}</div>
          <div>{formatter(hoverPoint.value)}</div>
        </ChartTooltip>
      )}
    </div>
  );
};

const StackedBarChart: React.FC<{
  points: ExecutorPoint[];
  executors: ExecutorSeries[];
}> = ({ points, executors }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartWidth = useResponsiveChartWidth(containerRef);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (!points.length) {
    return (
      <div className="app-panel-muted flex h-[190px] items-center justify-center text-sm text-slate-500">
        Нет данных для графика
      </div>
    );
  }

  const totals = points.map((point) =>
    executors.reduce((sum, executor) => sum + (point.totals[executor.id] ?? 0), 0),
  );
  const maxValue = Math.max(...totals, 1);
  const width = chartWidth;
  const height = CHART_HEIGHT;
  const plotWidth = width - CHART_PADDING * 2;
  const plotHeight = height - CHART_PADDING * 2;
  const barWidth = plotWidth / points.length;

  const startLabel = formatShortDate(points[0].date);
  const endLabel = formatShortDate(points[points.length - 1].date);
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;
  const tooltipMaxLeft = Math.max(width - 220, TOOLTIP_OFFSET);

  return (
    <div
      className="relative"
      ref={containerRef}
      onMouseLeave={() => setHoverIndex(null)}
      onMouseMove={(event) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) {
          return;
        }
        const x = event.clientX - rect.left - CHART_PADDING;
        const ratio = Math.min(Math.max(x / plotWidth, 0), 1);
        const index = Math.floor(ratio * points.length);
        setHoverIndex(Math.min(index, points.length - 1));
      }}
    >
      <div className="app-panel-muted p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
          {points.map((point, index) => {
            const x = CHART_PADDING + index * barWidth + barWidth * 0.2;
            let y = CHART_PADDING + plotHeight;
            const widthValue = barWidth * 0.6;
            return executors.map((executor) => {
              const value = point.totals[executor.id] ?? 0;
              if (!value) {
                return null;
              }
              const segmentHeight = (value / maxValue) * plotHeight;
              y -= segmentHeight;
              return (
                <rect
                  key={`${point.date}-${executor.id}`}
                  x={x}
                  y={y}
                  width={widthValue}
                  height={segmentHeight}
                  rx={4}
                  fill={executor.color}
                  opacity={0.9}
                />
              );
            });
          })}
        </svg>
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>{startLabel}</span>
          <span>{endLabel}</span>
        </div>
      </div>
      {hoverPoint && (
        <ChartTooltip
          left={clamp(CHART_PADDING + TOOLTIP_OFFSET, TOOLTIP_OFFSET, tooltipMaxLeft)}
          top={CHART_PADDING}
        >
          <div className="font-semibold text-slate-900">{formatShortDate(hoverPoint.date)}</div>
          {executors.map((executor) => (
            <div key={executor.id} className="flex items-center gap-2">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: executor.color }}
              />
              <span className="text-slate-600">{executor.name}</span>
              <span className="font-semibold text-slate-900">
                {hoverPoint.totals[executor.id] ?? 0}
              </span>
            </div>
          ))}
        </ChartTooltip>
      )}
    </div>
  );
};

const FinancialCellView: React.FC<{ cell?: FinancialCell | null }> = ({ cell }) => {
  if (!cell || (!cell.income && !cell.expense && !cell.net && !cell.count)) {
    return <span className="text-xs text-slate-400">—</span>;
  }
  return (
    <div className="space-y-1 text-xs">
      <div className="text-emerald-700">+ {formatCurrencyRu(cell.income, '—')}</div>
      <div className="text-rose-700">- {formatCurrencyRu(cell.expense, '—')}</div>
      <div
        className={cell.net < 0 ? 'font-semibold text-rose-700' : 'font-semibold text-slate-900'}
      >
        = {formatCurrencyRu(cell.net, '—')}
      </div>
      <div className="text-[11px] text-slate-400">Записей: {cell.count}</div>
    </div>
  );
};

export const SellerDashboardView: React.FC = () => {
  const [dashboard, setDashboard] = useState<SellerDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [calendarMode, setCalendarMode] = useState<'sum' | 'split'>('sum');

  const loadDashboard = useCallback(async (override?: { startDate?: string; endDate?: string }) => {
    setIsLoading(true);
    try {
      const payload = await fetchSellerDashboard(override);
      setDashboard(payload);
      setError(null);
      setStartDate((prev) => prev || payload.rangeStart || '');
      setEndDate((prev) => prev || payload.rangeEnd || '');
    } catch (err) {
      setDashboard(null);
      setError(formatErrorMessage(err, 'Ошибка загрузки дашборда.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const periodLabel = useMemo(() => {
    if (!dashboard?.rangeStart || !dashboard?.rangeEnd) {
      return 'Период';
    }
    return `Период: ${formatDateRu(dashboard.rangeStart)} — ${formatDateRu(dashboard.rangeEnd)}`;
  }, [dashboard?.rangeEnd, dashboard?.rangeStart]);

  const policies = dashboard?.policies ?? [];
  const totalPaid = dashboard?.totalPaid ?? '0';
  const tasksCurrent = dashboard?.tasksCurrent ?? 0;
  const tasksCompleted = dashboard?.tasksCompleted ?? 0;
  const isEmpty = !isLoading && policies.length === 0;

  const paymentsSeries = useMemo(() => {
    if (!dashboard?.rangeStart || !dashboard?.rangeEnd) {
      return [] as ChartPoint[];
    }
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
    if (!dashboard?.rangeStart || !dashboard?.rangeEnd) {
      return [] as CalendarDay[];
    }
    return buildCalendarDays(
      dashboard.rangeStart,
      dashboard.rangeEnd,
      policyExpirationsMap,
      nextContactsMap,
    );
  }, [dashboard?.rangeEnd, dashboard?.rangeStart, policyExpirationsMap, nextContactsMap]);
  const calendarWeeks = useMemo(() => {
    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7));
    }
    return weeks;
  }, [calendarDays]);
  const calendarMax = useMemo(() => {
    const totals = calendarDays.map((day) => day.policyExpirations + day.nextContacts);
    return Math.max(...totals, 0);
  }, [calendarDays]);
  const calendarMaxPolicy = useMemo(() => {
    const totals = calendarDays.map((day) => day.policyExpirations);
    return Math.max(...totals, 0);
  }, [calendarDays]);
  const calendarMaxContacts = useMemo(() => {
    const totals = calendarDays.map((day) => day.nextContacts);
    return Math.max(...totals, 0);
  }, [calendarDays]);

  const financialRows = useMemo(
    () => dashboard?.financialByCompanyType ?? [],
    [dashboard?.financialByCompanyType],
  );
  const financialTotals = useMemo(
    () =>
      dashboard?.financialTotals ?? {
        incomeTotal: '0',
        expenseTotal: '0',
        netTotal: '0',
        recordsCount: 0,
      },
    [dashboard?.financialTotals],
  );
  const financialMatrix = useMemo(() => {
    const companyNames = new Map<string, string>();
    const typeNames = new Map<string, string>();
    const rowsByCompany = new Map<string, FinancialCompanyRow>();
    const columnTotals = new Map<string, FinancialCell>();
    const grandTotals = createEmptyFinancialCell();

    financialRows.forEach((row) => {
      const companyName = (row.insuranceCompanyName || '').trim() || UNKNOWN_GROUP_LABEL;
      const typeName = (row.insuranceTypeName || '').trim() || UNKNOWN_GROUP_LABEL;
      const companyKey = row.insuranceCompanyId || `unknown-company:${companyName}`;
      const typeKey = row.insuranceTypeId || `unknown-type:${typeName}`;

      companyNames.set(companyKey, companyName);
      typeNames.set(typeKey, typeName);

      if (!rowsByCompany.has(companyKey)) {
        rowsByCompany.set(companyKey, {
          companyKey,
          companyName,
          cells: new Map<string, FinancialCell>(),
          totals: createEmptyFinancialCell(),
        });
      }
      const companyRow = rowsByCompany.get(companyKey);
      if (!companyRow) {
        return;
      }
      companyRow.companyName = companyName;
      const nextCell = buildFinancialCellFromRow(row);
      companyRow.cells.set(typeKey, nextCell);
      appendFinancialCell(companyRow.totals, nextCell);

      if (!columnTotals.has(typeKey)) {
        columnTotals.set(typeKey, createEmptyFinancialCell());
      }
      const columnTotal = columnTotals.get(typeKey);
      if (columnTotal) {
        appendFinancialCell(columnTotal, nextCell);
      }
      appendFinancialCell(grandTotals, nextCell);
    });

    const types: FinancialTypeColumn[] = Array.from(typeNames.entries())
      .map(([typeKey, typeName]) => ({ typeKey, typeName }))
      .sort((left, right) => compareFinancialGroupLabels(left.typeName, right.typeName));

    const rows: FinancialCompanyRow[] = Array.from(rowsByCompany.values()).sort((left, right) =>
      compareFinancialGroupLabels(left.companyName, right.companyName),
    );

    return {
      rows,
      types,
      columnTotals,
      grandTotals,
    };
  }, [financialRows]);
  const hasFinancialRows = financialRows.length > 0;

  const handleApply = useCallback(() => {
    void loadDashboard({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
  }, [endDate, loadDashboard, startDate]);

  return (
    <section aria-labelledby="sellerDashboardHeading" className="space-y-6">
      <div className="app-panel p-6 shadow-none space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Дашборд продавца</p>
            <h1 id="sellerDashboardHeading" className="text-2xl font-semibold text-slate-900">
              Продажи по дате начала полиса
            </h1>
            <p className="text-sm text-slate-600">{periodLabel}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-sky-50 px-4 py-3 text-right">
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-600">
                Сумма оплаченных платежей
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {formatCurrencyRu(totalPaid, '—')}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Текущие задачи
              </p>
              <p className="text-2xl font-semibold text-slate-900">{tasksCurrent}</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Завершено задач
              </p>
              <p className="text-2xl font-semibold text-slate-900">{tasksCompleted}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="app-label" htmlFor="sellerDashboardStart">
              Дата начала
            </label>
            <input
              id="sellerDashboardStart"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              className="field field-input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="app-label" htmlFor="sellerDashboardEnd">
              Дата окончания
            </label>
            <input
              id="sellerDashboardEnd"
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              className="field field-input"
            />
          </div>
          <button
            type="button"
            onClick={handleApply}
            className={BTN_SM_PRIMARY}
            disabled={isLoading}
          >
            Показать
          </button>
        </div>
        <p className="text-sm text-slate-600">
          Учитываются только полисы с датой начала в выбранном диапазоне и только оплаченные
          платежи.
        </p>
        {error && <div className="app-panel-muted px-4 py-3 text-sm text-rose-700">{error}</div>}
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="app-panel p-6 shadow-none space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Оплаченные платежи по дням</h2>
            <p className="text-xs text-slate-500">Сумма оплат по фактической дате платежа</p>
          </div>
          {isLoading ? (
            <div className="app-panel-muted flex h-[190px] items-center justify-center text-sm text-slate-500">
              Загрузка данных...
            </div>
          ) : (
            <LineChart
              points={paymentsSeries}
              formatter={(value) => formatCurrencyRu(value, '—')}
            />
          )}
        </div>
        <div className="app-panel p-6 shadow-none space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Завершенные задачи по дням</h2>
            <p className="text-xs text-slate-500">Только задачи по сделкам, где вы продавец</p>
          </div>
          {isLoading ? (
            <div className="app-panel-muted flex h-[190px] items-center justify-center text-sm text-slate-500">
              Загрузка данных...
            </div>
          ) : (
            <StackedBarChart points={executorSeries.data} executors={executorSeries.executors} />
          )}
          {!!executorSeries.executors.length && (
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              {executorSeries.executors.map((executor) => (
                <span
                  key={executor.id}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-2 py-1 shadow-sm"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: executor.color }}
                  />
                  {executor.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="app-panel p-6 shadow-none space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Финансовая аналитика</h2>
            <p className="text-xs text-slate-500">
              Доходы и расходы по проведенным финзаписям в полисах выбранного периода
            </p>
          </div>
          <div className="text-xs text-slate-500">
            Проведено записей:{' '}
            <span className="font-semibold text-slate-700">{financialTotals.recordsCount}</span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-emerald-50 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Доходы</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCurrencyRu(financialTotals.incomeTotal, '—')}
            </p>
          </div>
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Расходы</p>
            <p className="text-2xl font-semibold text-slate-900">
              {formatCurrencyRu(financialTotals.expenseTotal, '—')}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Чистая</p>
            <p
              className={`text-2xl font-semibold ${
                parseNumber(financialTotals.netTotal) < 0 ? 'text-rose-700' : 'text-slate-900'
              }`}
            >
              {formatCurrencyRu(financialTotals.netTotal, '—')}
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="app-panel-muted flex h-[240px] items-center justify-center text-sm text-slate-500">
            Загрузка данных...
          </div>
        ) : !hasFinancialRows ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            Нет проведенных финансовых записей за выбранный период.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 border-b border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Страховая компания
                  </th>
                  {financialMatrix.types.map((typeColumn) => (
                    <th
                      key={typeColumn.typeKey}
                      className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {typeColumn.typeName}
                    </th>
                  ))}
                  <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Итого по СК
                  </th>
                </tr>
              </thead>
              <tbody>
                {financialMatrix.rows.map((companyRow) => (
                  <tr key={companyRow.companyKey} className="align-top">
                    <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-3 py-3 text-sm font-semibold text-slate-700">
                      {companyRow.companyName}
                    </td>
                    {financialMatrix.types.map((typeColumn) => (
                      <td
                        key={`${companyRow.companyKey}-${typeColumn.typeKey}`}
                        className="border-b border-slate-100 px-3 py-3"
                      >
                        <FinancialCellView cell={companyRow.cells.get(typeColumn.typeKey)} />
                      </td>
                    ))}
                    <td className="border-b border-slate-100 bg-slate-50 px-3 py-3">
                      <FinancialCellView cell={companyRow.totals} />
                    </td>
                  </tr>
                ))}
                <tr className="align-top">
                  <td className="sticky left-0 z-10 border-t border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-900">
                    Итого по видам
                  </td>
                  {financialMatrix.types.map((typeColumn) => (
                    <td
                      key={`totals-${typeColumn.typeKey}`}
                      className="border-t border-slate-300 bg-slate-50 px-3 py-3"
                    >
                      <FinancialCellView
                        cell={financialMatrix.columnTotals.get(typeColumn.typeKey)}
                      />
                    </td>
                  ))}
                  <td className="border-t border-slate-300 bg-slate-100 px-3 py-3">
                    <FinancialCellView cell={financialMatrix.grandTotals} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="app-panel p-6 shadow-none space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Календарь нагрузки</h2>
            <p className="text-xs text-slate-500">
              Окончания полисов и следующие контакты по выбранному диапазону
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-2 py-1">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500" />
              Окончания полисов
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-2 py-1">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-700" />
              Следующие контакты
            </span>
            <div className="ml-1 inline-flex items-center gap-1 rounded-full bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setCalendarMode('sum')}
                className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                  calendarMode === 'sum' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Сумма
              </button>
              <button
                type="button"
                onClick={() => setCalendarMode('split')}
                className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                  calendarMode === 'split' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
                }`}
              >
                Раздельно
              </button>
            </div>
          </div>
        </div>
        {isLoading ? (
          <div className="app-panel-muted flex h-[260px] items-center justify-center text-sm text-slate-500">
            Загрузка данных...
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-7 gap-2 text-xs text-slate-400">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((label) => (
                <div key={label} className="text-center uppercase tracking-wide">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarWeeks.map((week, weekIndex) => (
                <React.Fragment key={`week-${weekIndex}`}>
                  {week.map((day) => {
                    const total = day.policyExpirations + day.nextContacts;
                    const intensity = calendarMax > 0 ? clamp(total / calendarMax, 0, 1) : 0;
                    const isEmpty = total === 0;
                    const heatmapColor =
                      calendarMode === 'sum' && day.isInRange && !isEmpty
                        ? `rgba(244, 63, 94, ${0.08 + intensity * 0.35})`
                        : undefined;
                    const policyWidth =
                      calendarMaxPolicy > 0
                        ? clamp(day.policyExpirations / calendarMaxPolicy, 0, 1)
                        : 0;
                    const contactsWidth =
                      calendarMaxContacts > 0
                        ? clamp(day.nextContacts / calendarMaxContacts, 0, 1)
                        : 0;
                    return (
                      <div
                        key={day.date}
                        title={`П: ${day.policyExpirations} / К: ${day.nextContacts}`}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                          day.isInRange
                            ? isEmpty
                              ? 'border-slate-100 text-slate-400'
                              : 'border-slate-200 text-slate-700'
                            : 'border-transparent text-slate-300'
                        }`}
                        style={{
                          backgroundColor: day.isInRange
                            ? (heatmapColor ?? (isEmpty ? '#f8fafc' : '#ffffff'))
                            : '#f8fafc',
                        }}
                      >
                        <div
                          className={`flex items-center justify-between text-xs ${
                            day.isWeekend ? 'text-rose-500' : 'text-slate-500'
                          }`}
                        >
                          <span>{day.day}</span>
                          {calendarMode === 'sum' && total > 0 && (
                            <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] text-slate-600">
                              {total}
                            </span>
                          )}
                        </div>
                        {calendarMode === 'sum' ? (
                          <div className="mt-3 text-center text-sm font-semibold text-slate-900">
                            {total > 0 ? `Всего: ${total}` : ''}
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-slate-400">
                                Полисов:
                              </span>
                              <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                                <div
                                  className="h-1.5 rounded-full bg-rose-500"
                                  style={{ width: `${policyWidth * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-slate-700">
                                {day.policyExpirations}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-semibold text-slate-400">
                                Контактов:
                              </span>
                              <div className="h-1.5 flex-1 rounded-full bg-slate-100">
                                <div
                                  className="h-1.5 rounded-full bg-rose-700"
                                  style={{ width: `${contactsWidth * 100}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-semibold text-slate-700">
                                {day.nextContacts}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="app-panel p-6 shadow-none space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Полисы выбранного периода</h2>
        {isLoading ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            Загрузка данных...
          </div>
        ) : isEmpty ? (
          <div className="app-panel-muted px-5 py-6 text-center text-sm text-slate-600">
            В этом периоде у вас нет полисов с началом в выбранном диапазоне.
          </div>
        ) : (
          <div className="text-sm text-slate-600">
            Всего полисов в диапазоне:{' '}
            <span className="font-semibold text-slate-900">{policies.length}</span>
          </div>
        )}
      </section>
    </section>
  );
};
