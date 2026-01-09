import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchSellerDashboard } from '../../api/policies';
import type {
  SellerDashboardPaymentsByDay,
  SellerDashboardResponse,
  SellerDashboardTasksByExecutor,
} from '../../types';
import { formatCurrencyRu, formatDateRu, RU_LOCALE } from '../../utils/formatting';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

const CHART_HEIGHT = 190;
const CHART_WIDTH = 720;
const CHART_PADDING = 28;
const TOOLTIP_OFFSET = 12;
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

const parseNumber = (value: string | number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

const LineChart: React.FC<{ points: ChartPoint[]; formatter: (value: number) => string }> = ({
  points,
  formatter,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  const width = CHART_WIDTH;
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
        <ChartTooltip left={toX(hoverIndex ?? 0) + TOOLTIP_OFFSET} top={CHART_PADDING}>
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
  const width = CHART_WIDTH;
  const height = CHART_HEIGHT;
  const plotWidth = width - CHART_PADDING * 2;
  const plotHeight = height - CHART_PADDING * 2;
  const barWidth = plotWidth / points.length;

  const startLabel = formatShortDate(points[0].date);
  const endLabel = formatShortDate(points[points.length - 1].date);
  const hoverPoint = hoverIndex !== null ? points[hoverIndex] : null;

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
        <ChartTooltip left={CHART_PADDING + TOOLTIP_OFFSET} top={CHART_PADDING}>
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

export const SellerDashboardView: React.FC = () => {
  const [dashboard, setDashboard] = useState<SellerDashboardResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
            className="btn btn-primary btn-sm rounded-xl"
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
