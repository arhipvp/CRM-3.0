import React from 'react';

import { formatCurrencyRu } from '../../../utils/formatting';
import { isFinancialCellEmpty, type FinancialCell } from './dashboardCalculations';

export const FinancialCellView: React.FC<{
  cell?: FinancialCell | null;
  showEmptyPlaceholder?: boolean;
}> = ({ cell, showEmptyPlaceholder = true }) => {
  if (isFinancialCellEmpty(cell)) {
    return showEmptyPlaceholder ? <span className="text-xs text-slate-400">—</span> : null;
  }
  const nextCell = cell as FinancialCell;
  return (
    <div className="space-y-1 text-xs">
      <div className="font-medium text-emerald-700">+ {formatCurrencyRu(nextCell.income, '—')}</div>
      <div className="font-medium text-rose-700">- {formatCurrencyRu(nextCell.expense, '—')}</div>
      <div
        className={
          nextCell.net < 0 ? 'font-semibold text-rose-700' : 'font-semibold text-slate-900'
        }
      >
        = {formatCurrencyRu(nextCell.net, '—')}
      </div>
      <div className="text-[11px] text-slate-400">Записей: {nextCell.count}</div>
    </div>
  );
};
