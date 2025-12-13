import React from 'react';
import type { Deal, Quote } from '../../../../types';
import { formatCurrency, formatDate } from '../helpers';
import { ColoredLabel } from '../../../common/ColoredLabel';

type QuoteSortKey =
  | 'insuranceType'
  | 'insuranceCompany'
  | 'sumInsured'
  | 'premium'
  | 'deductible'
  | 'comments'
  | 'seller'
  | 'createdAt';

interface QuotesTabProps {
  selectedDeal: Deal | null;
  quotes: Quote[];
  onRequestAddQuote: (dealId: string) => void;
  onRequestEditQuote: (quote: Quote) => void;
  onDeleteQuote: (dealId: string, quoteId: string) => Promise<void>;
}

export const QuotesTab: React.FC<QuotesTabProps> = ({
  selectedDeal,
  quotes,
  onRequestAddQuote,
  onRequestEditQuote,
  onDeleteQuote,
}) => {
  const [sortConfig, setSortConfig] = React.useState<
    | {
        key: QuoteSortKey;
        direction: 'asc' | 'desc';
      }
    | null
  >(null);

  const handleSort = React.useCallback((key: QuoteSortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }, []);

  const sortedQuotes = React.useMemo(() => {
    if (!sortConfig) {
      return quotes;
    }

    const directionMultiplier = sortConfig.direction === 'asc' ? 1 : -1;

    const compareStrings = (a: string, b: string) =>
      a.localeCompare(b, 'ru', { sensitivity: 'base' });

    const compareQuotes = (a: Quote, b: Quote) => {
      switch (sortConfig.key) {
        case 'sumInsured':
          return a.sumInsured - b.sumInsured;
        case 'premium':
          return a.premium - b.premium;
        case 'createdAt':
          return (Date.parse(a.createdAt) || 0) - (Date.parse(b.createdAt) || 0);
        case 'insuranceType':
          return compareStrings(String(a.insuranceType ?? ''), String(b.insuranceType ?? ''));
        case 'insuranceCompany':
          return compareStrings(String(a.insuranceCompany ?? ''), String(b.insuranceCompany ?? ''));
        case 'deductible':
          return compareStrings(String(a.deductible ?? ''), String(b.deductible ?? ''));
        case 'comments':
          return compareStrings(String(a.comments ?? ''), String(b.comments ?? ''));
        case 'seller': {
          const sellerA = a.sellerName || a.sellerId || '';
          const sellerB = b.sellerName || b.sellerId || '';
          return compareStrings(String(sellerA), String(sellerB));
        }
        default:
          return 0;
      }
    };

    return quotes
      .map((quote, index) => ({ quote, index }))
      .sort((left, right) => {
        const result = compareQuotes(left.quote, right.quote);
        if (result !== 0) {
          return result * directionMultiplier;
        }
        return left.index - right.index;
      })
      .map(({ quote }) => quote);
  }, [quotes, sortConfig]);

  const SortableHeader: React.FC<{ label: string; sortKey: QuoteSortKey; className?: string }> = ({
    label,
    sortKey,
    className,
  }) => {
    const isActive = sortConfig?.key === sortKey;
    const ariaSort = isActive ? (sortConfig?.direction === 'asc' ? 'ascending' : 'descending') : 'none';

    return (
      <th className={`px-4 py-3 ${className ?? ''}`} aria-sort={ariaSort}>
        <button
          type="button"
          onClick={() => handleSort(sortKey)}
          className="w-full flex items-center gap-2 text-left hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 rounded-md"
        >
          <span>{label}</span>
          {isActive && <span className="text-[11px]">{sortConfig?.direction === 'asc' ? '↑' : '↓'}</span>}
        </button>
      </th>
    );
  };

  if (!selectedDeal) {
    return null;
  }

  return (
    <section className="app-panel p-6 shadow-none space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="app-label">Расчёты</p>
        <button
          type="button"
          onClick={() => onRequestAddQuote(selectedDeal.id)}
          className="btn btn-secondary btn-sm rounded-xl"
        >
          + Добавить расчёт
        </button>
      </div>
      {!quotes.length ? (
        <p className="text-sm text-slate-600">Расчётов пока нет.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm text-left">
            <thead className="text-[10px] uppercase tracking-[0.2em] text-slate-500 bg-slate-50">
              <tr>
                <SortableHeader label="Тип" sortKey="insuranceType" />
                <SortableHeader label="Компания" sortKey="insuranceCompany" />
                <SortableHeader label="Сумма" sortKey="sumInsured" />
                <SortableHeader label="Премия" sortKey="premium" />
                <SortableHeader label="Франшиза" sortKey="deductible" />
                <SortableHeader label="Комментарии" sortKey="comments" />
                <SortableHeader label="Добавлен" sortKey="seller" />
                <SortableHeader label="Дата" sortKey="createdAt" />
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedQuotes.map((quote) => (
                <tr key={quote.id} className="odd:bg-white even:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{quote.insuranceType}</td>
                  <td className="px-4 py-3">
                    <ColoredLabel
                      value={quote.insuranceCompany}
                      fallback="-"
                      showDot
                      className="text-slate-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-900">{formatCurrency(String(quote.sumInsured))}</td>
                  <td className="px-4 py-3 text-slate-900">{formatCurrency(String(quote.premium))}</td>
                  <td className="px-4 py-3 text-slate-900">{quote.deductible || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{quote.comments || '—'}</td>
                  <td className="px-4 py-3">
                    <ColoredLabel
                      value={quote.sellerName || quote.sellerId}
                      fallback="-"
                      showDot={false}
                      className="text-slate-600"
                    />
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(quote.createdAt)}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      className="text-xs font-semibold text-sky-700 hover:text-sky-900"
                      onClick={() => onRequestEditQuote(quote)}
                      type="button"
                    >
                      Редактировать
                    </button>
                    <button
                      className="text-xs font-semibold text-rose-500 hover:text-rose-600"
                      onClick={() => onDeleteQuote(String(selectedDeal.id), String(quote.id)).catch(() => undefined)}
                      type="button"
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
