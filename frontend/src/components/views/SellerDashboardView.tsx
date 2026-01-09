import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchSellerDashboard } from '../../api/policies';
import type {
  SellerDashboardPaymentsByDay,
  SellerDashboardResponse,
  SellerDashboardTasksByDay,
} from '../../types';
import { formatCurrencyRu, formatDateRu, RU_LOCALE } from '../../utils/formatting';
import { formatErrorMessage } from '../../utils/formatErrorMessage';

const CHART_HEIGHT = 180;
const CHART_WIDTH = 640;
const CHART_PADDING = 28;

type ChartPoint = {
  date: string;
  value: number;
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
  items: SellerDashboardPaymentsByDay[]
): ChartPoint[] => {
  const range = buildDateRange(rangeStart, rangeEnd);
  const map = new Map(items.map((item) => [item.date, parseNumber(item.total)]));
  return range.map((date) => ({ date, value: map.get(date) ?? 0 }));
};

const buildTasksSeries = (
  rangeStart: string,
  rangeEnd: string,
  items: SellerDashboardTasksByDay[]
): ChartPoint[] => {
  const range = buildDateRange(rangeStart, rangeEnd);
  const map = new Map(items.map((item) => [item.date, item.count]));
  return range.map((date) => ({ date, value: map.get(date) ?? 0 }));
};

const LineChart: React.FC<{ points: ChartPoint[] }> = ({ points }) => {
  if (!points.length) {
    return (
      <div className="app-panel-muted flex h-[180px] items-center justify-center text-sm text-slate-500">
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

  const toX = (index: number) =>
    CHART_PADDING + (index / (points.length - 1 || 1)) * plotWidth;
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

  return (
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
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
};

const BarChart: React.FC<{ points: ChartPoint[] }> = ({ points }) => {
  if (!points.length) {
    return (
      <div className="app-panel-muted flex h-[180px] items-center justify-center text-sm text-slate-500">
        Нет данных для графика
      </div>
    );
  }

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const width = CHART_WIDTH;
  const height = CHART_HEIGHT;
  const plotWidth = width - CHART_PADDING * 2;
  const plotHeight = height - CHART_PADDING * 2;
  const barWidth = plotWidth / points.length;

  const startLabel = formatShortDate(points[0].date);
  const endLabel = formatShortDate(points[points.length - 1].date);

  return (
    <div className="app-panel-muted p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {points.map((point, index) => {
          const barHeight = (point.value / maxValue) * plotHeight;
          const x = CHART_PADDING + index * barWidth + barWidth * 0.2;
          const y = CHART_PADDING + plotHeight - barHeight;
          const widthValue = barWidth * 0.6;
          return (
            <rect
              key={point.date}
              x={x}
              y={y}
              width={widthValue}
              height={barHeight}
              rx={4}
              fill="#0ea5e9"
              opacity={point.value === 0 ? 0.4 : 0.9}
            />
          );
        })}
      </svg>
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
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
    return buildPaymentsSeries(
      dashboard.rangeStart,
      dashboard.rangeEnd,
      dashboard.paymentsByDay
    );
  }, [dashboard?.paymentsByDay, dashboard?.rangeEnd, dashboard?.rangeStart]);

  const tasksSeries = useMemo(() => {
    if (!dashboard?.rangeStart || !dashboard?.rangeEnd) {
      return [] as ChartPoint[];
    }
    return buildTasksSeries(
      dashboard.rangeStart,
      dashboard.rangeEnd,
      dashboard.tasksCompletedByDay
    );
  }, [dashboard?.rangeEnd, dashboard?.rangeStart, dashboard?.tasksCompletedByDay]);

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
            <p className="text-xs uppercase tracking-wide text-slate-400">
              Дашборд продавца
            </p>
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
              <p className="text-2xl font-semibold text-slate-900">
                {tasksCurrent}
              </p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Завершено задач
              </p>
              <p className="text-2xl font-semibold text-slate-900">
                {tasksCompleted}
              </p>
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
          Учитываются только полисы с датой начала в выбранном диапазоне и только оплаченные платежи.
        </p>
        {error && (
          <div className="app-panel-muted px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="app-panel p-6 shadow-none space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Оплаченные платежи по дням</h2>
            <p className="text-xs text-slate-500">
              Сумма оплат по фактической дате платежа
            </p>
          </div>
          {isLoading ? (
            <div className="app-panel-muted flex h-[180px] items-center justify-center text-sm text-slate-500">
              Загрузка данных...
            </div>
          ) : (
            <LineChart points={paymentsSeries} />
          )}
        </div>
        <div className="app-panel p-6 shadow-none space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">Завершенные задачи по дням</h2>
            <p className="text-xs text-slate-500">
              Только задачи по сделкам, где вы продавец
            </p>
          </div>
          {isLoading ? (
            <div className="app-panel-muted flex h-[180px] items-center justify-center text-sm text-slate-500">
              Загрузка данных...
            </div>
          ) : (
            <BarChart points={tasksSeries} />
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
            Всего полисов в диапазоне: <span className="font-semibold text-slate-900">{policies.length}</span>
          </div>
        )}
      </section>
    </section>
  );
};
