import type { ReactNode } from 'react';

import { AppIcon } from '../common/AppIcon';
import { getPolicyTermIndicator } from './policyIndicators';

const POLICY_TERM_TONE_CLASS = {
  green: 'bg-emerald-100 text-emerald-700',
  orange: 'bg-orange-100 text-orange-700',
  red: 'bg-red-100 text-red-700',
  neutral: 'bg-slate-100 text-slate-600',
} as const;

export function PolicyDataField({
  label,
  children,
  className = '',
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2.5 ${className}`}>
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-1 min-w-0 text-sm font-semibold text-slate-900">{children}</div>
    </div>
  );
}

export function PolicyTermCard({
  startDate,
  endDate,
  endDateValue,
}: {
  startDate: string;
  endDate: string;
  endDateValue?: string | null;
}) {
  const indicator = getPolicyTermIndicator(endDateValue);
  return (
    <div className="space-y-5 py-1" data-testid="policy-term-card">
      <div className="relative pl-8">
        <AppIcon name="policies" size={17} className="absolute left-0 top-0.5 text-slate-500" />
        <p className="text-xs font-medium text-slate-500">Начало</p>
        <p className="mt-1 whitespace-nowrap text-sm font-bold text-slate-900">{startDate}</p>
      </div>
      <div className="relative border-l border-slate-200 pl-8 before:absolute before:-left-1 before:top-[-1.6rem] before:h-6 before:w-px before:bg-slate-200">
        <AppIcon
          name="policies"
          size={17}
          className="absolute -left-2 top-0.5 bg-white text-slate-500"
        />
        <p className="text-xs font-medium text-slate-500">Конец</p>
        <p className="mt-1 whitespace-nowrap text-sm font-bold text-slate-900">{endDate}</p>
      </div>
      <div className="relative pl-8">
        <AppIcon name="refresh" size={17} className="absolute left-0 top-0.5 text-slate-500" />
        <p className="text-xs font-medium text-slate-500">Дней до окончания</p>
        <span
          className={`mt-1 inline-flex rounded-md px-2 py-1 text-xs font-bold ${POLICY_TERM_TONE_CLASS[indicator.tone]}`}
        >
          {indicator.label}
        </span>
      </div>
    </div>
  );
}

export function PolicyEmptyLedger() {
  return (
    <div
      className="flex min-h-28 flex-col items-center justify-center gap-2 text-center text-sm text-slate-500"
      data-testid="policy-empty-ledger"
    >
      <AppIcon name="folder" size={28} className="text-slate-400" />
      <span>Записей пока нет</span>
    </div>
  );
}
