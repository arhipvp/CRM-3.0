import React from 'react';

import type { Policy } from '../../types';
import type { PolicyCardModel } from './policyCardModel';
import { getPolicyComputedStatusBadge } from './policyIndicators';

interface PolicySummaryBlocksProps {
  policy: Policy;
  model: PolicyCardModel;
  className?: string;
}

const statusToneClass: Record<'red' | 'orange' | 'green', string> = {
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  green: 'bg-emerald-100 text-emerald-700',
};

export const PolicySummaryBlocks: React.FC<PolicySummaryBlocksProps> = ({
  policy,
  model,
  className = '',
}) => {
  const computedStatus = getPolicyComputedStatusBadge(policy.computedStatus);

  return (
    <div className={`grid gap-3 lg:grid-cols-3 ${className}`.trim()}>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Основное
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{model.number}</p>
        <p className="text-xs text-slate-600">{model.client}</p>
        <p className="text-xs text-slate-600">{model.insuranceCompany}</p>
        <p className="text-xs text-slate-600">{model.insuranceType}</p>
        <p className="text-xs text-slate-600">{model.salesChannel}</p>
        <p className="mt-2 text-xs text-slate-700 whitespace-pre-wrap break-words">
          {policy.note?.trim() ? policy.note : 'Без примечания'}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Сроки</p>
        <p className="mt-1 text-xs text-slate-700">Начало: {model.startDate}</p>
        <p className="text-xs text-slate-700">Окончание: {model.endDate}</p>
        <p className="mt-2">
          {computedStatus ? (
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                statusToneClass[computedStatus.tone]
              }`}
            >
              {computedStatus.label}
            </span>
          ) : (
            <span className="text-xs text-slate-500">Статус не определен</span>
          )}
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
          Финансы
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{model.sum}</p>
        <p className="text-xs text-slate-600">Платежей: {model.paymentsCount}</p>
      </div>
    </div>
  );
};
