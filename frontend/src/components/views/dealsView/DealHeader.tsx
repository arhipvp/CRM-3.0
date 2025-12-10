import React from 'react';

import { ColoredLabel } from '../../common/ColoredLabel';
import type { Deal } from '../../../types';

interface DealHeaderProps {
  deal: Deal;
  clientDisplayName: string;
  sellerDisplayName: string;
  executorDisplayName: string;
}

export const DealHeader: React.FC<DealHeaderProps> = ({
  deal,
  clientDisplayName,
  sellerDisplayName,
  executorDisplayName,
}) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-2">
        <p className="text-[10px] tracking-[0.4em] text-slate-400 uppercase">
          Выбранная сделка:
        </p>
        <p className="text-base font-semibold text-slate-900">{deal.title}</p>
      </div>
      {deal.description && (
        <p className="text-sm leading-relaxed text-slate-500 max-w-3xl">
          {deal.description}
        </p>
      )}
      <p className="text-sm text-slate-500">
        Клиент:
        <span className="ml-2 text-base font-semibold text-slate-900">{clientDisplayName}</span>
      </p>
      <p className="text-xs text-slate-400">
        Ответственный:{' '}
        <ColoredLabel
          value={sellerDisplayName !== '—' ? sellerDisplayName : undefined}
          fallback="—"
          showDot={false}
          className="text-slate-900 font-semibold"
        />{' '}
        · Исполнитель:{' '}
        <ColoredLabel
          value={executorDisplayName !== '—' ? executorDisplayName : undefined}
          fallback="—"
          showDot={false}
          className="text-slate-900 font-semibold"
        />
      </p>
      {deal.closingReason && (
        <p className="text-xs text-slate-500">Причина закрытия: {deal.closingReason}</p>
      )}
    </div>
  </div>
);
