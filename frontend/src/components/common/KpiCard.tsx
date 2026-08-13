import type { ReactNode } from 'react';

import type { SemanticTone } from './layoutPrimitives';

export interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: SemanticTone;
  className?: string;
}

const toneClassName: Record<SemanticTone, string> = {
  neutral: 'kpi-card-neutral',
  brand: 'kpi-card-brand',
  primary: 'kpi-card-brand',
  success: 'kpi-card-success',
  warning: 'kpi-card-warning',
  danger: 'kpi-card-danger',
  info: 'kpi-card-info',
  income: 'kpi-card-income',
  expense: 'kpi-card-expense',
  balance: 'kpi-card-balance',
  due: 'kpi-card-due',
  overdue: 'kpi-card-overdue',
  selected: 'kpi-card-selected',
};

export function KpiCard({
  label,
  value,
  hint,
  icon,
  tone = 'neutral',
  className = '',
}: KpiCardProps) {
  return (
    <article
      className={['kpi-card', toneClassName[tone], className].filter(Boolean).join(' ')}
      aria-label={label}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="app-label text-current opacity-75">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-current">{value}</p>
        </div>
        {icon && <span className="shrink-0 opacity-70">{icon}</span>}
      </div>
      {hint && <div className="mt-2 text-xs text-current opacity-75">{hint}</div>}
    </article>
  );
}
