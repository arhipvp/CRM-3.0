import React, { useEffect, useRef, useState } from 'react';

import { RU_LOCALE } from '../../../utils/formatting';
import type { ChartPoint, ExecutorPoint, ExecutorSeries } from './dashboardCalculations';

const CHART_HEIGHT = 190;
const CHART_PADDING = 28;
const TOOLTIP_OFFSET = 12;
const MIN_CHART_WIDTH = 320;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, max));

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

export const LineChart: React.FC<{
  points: ChartPoint[];
  formatter: (value: number) => string;
}> = ({ points, formatter }) => {
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

export const StackedBarChart: React.FC<{
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
