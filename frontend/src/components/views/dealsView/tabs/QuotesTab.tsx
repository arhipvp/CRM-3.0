import React from 'react';
import type { Deal, Quote } from '../../../../types';
import { formatCurrency, formatDate } from '../helpers';
import { ColoredLabel } from '../../../common/ColoredLabel';
import { TableHeadCell } from '../../../common/TableHeadCell';
import {
  TABLE_ACTIONS_CLASS_ROW,
  TABLE_CELL_CLASS_SM,
  TABLE_ROW_CLASS_PLAIN,
  TABLE_THEAD_CLASS,
} from '../../../common/tableStyles';

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
  const [sortConfig, setSortConfig] = React.useState<{
    key: QuoteSortKey;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [showDeletedQuotes, setShowDeletedQuotes] = React.useState(false);

  const deletedQuotesCount = React.useMemo(
    () => quotes.filter((quote) => Boolean(quote.deletedAt)).length,
    [quotes],
  );

  const visibleQuotes = React.useMemo(() => {
    if (showDeletedQuotes) {
      return quotes;
    }

    return quotes.filter((quote) => !quote.deletedAt);
  }, [quotes, showDeletedQuotes]);

  const handleSort = React.useCallback((key: QuoteSortKey) => {
    setSortConfig((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: 'asc' };
      }
      return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
    });
  }, []);

  const sortedQuotes = React.useMemo(() => {
    const baseQuotes = visibleQuotes;
    if (!sortConfig) {
      return baseQuotes;
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

    return baseQuotes
      .map((quote, index) => ({ quote, index }))
      .sort((left, right) => {
        const result = compareQuotes(left.quote, right.quote);
        if (result !== 0) {
          return result * directionMultiplier;
        }
        return left.index - right.index;
      })
      .map(({ quote }) => quote);
  }, [sortConfig, visibleQuotes]);

  const SortableHeader: React.FC<{ label: string; sortKey: QuoteSortKey; className?: string }> = ({
    label,
    sortKey,
    className,
  }) => {
    const isActive = sortConfig?.key === sortKey;
    const ariaSort = isActive
      ? sortConfig?.direction === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none';

    return (
      <TableHeadCell padding="sm" className={className} aria-sort={ariaSort}>
        <button
          type="button"
          onClick={() => handleSort(sortKey)}
          aria-label={`Сортировать по: ${label}. Текущий порядок: ${ariaSort === 'none' ? 'не задан' : ariaSort === 'ascending' ? 'по возрастанию' : 'по убыванию'}`}
          className="flex w-full items-center gap-2 text-left hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white rounded-md"
        >
          <span>{label}</span>
          {isActive && (
            <span className="text-[11px]">{sortConfig?.direction === 'asc' ? '↑' : '↓'}</span>
          )}
        </button>
      </TableHeadCell>
    );
  };

  if (!selectedDeal) {
    return null;
  }

  return (
    <section className="app-panel p-6 shadow-none space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="app-label">Расчёты</p>
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={showDeletedQuotes}
              onChange={(event) => setShowDeletedQuotes(event.target.checked)}
              className="check"
            />
            <span>Показывать удалённые</span>
            {deletedQuotesCount > 0 && (
              <span className="text-[11px] text-slate-400">({deletedQuotesCount})</span>
            )}
          </label>
        </div>
        <button
          type="button"
          onClick={() => onRequestAddQuote(selectedDeal.id)}
          className="btn btn-secondary btn-sm rounded-xl"
        >
          + Добавить расчёт
        </button>
      </div>
      {!visibleQuotes.length ? (
        <p className="text-sm text-slate-600">Расчётов пока нет.</p>
      ) : (
        <div className="overflow-x-auto bg-white">
          <table className="deals-table min-w-full border-collapse text-left text-sm">
            <thead className={TABLE_THEAD_CLASS}>
              <tr>
                <SortableHeader label="Тип" sortKey="insuranceType" />
                <SortableHeader label="Компания" sortKey="insuranceCompany" />
                <SortableHeader label="Сумма" sortKey="sumInsured" />
                <SortableHeader label="Премия" sortKey="premium" />
                <SortableHeader label="Франшиза" sortKey="deductible" />
                <SortableHeader label="Комментарии" sortKey="comments" />
                <SortableHeader label="Добавлен" sortKey="seller" />
                <SortableHeader label="Дата" sortKey="createdAt" />
                <TableHeadCell padding="sm" align="right" className="w-[160px]">
                  Действия
                </TableHeadCell>
              </tr>
            </thead>
            <tbody className="bg-white">
              {sortedQuotes.map((quote) => {
                const deletedTextClass = quote.deletedAt
                  ? 'line-through decoration-rose-500/80 text-slate-500'
                  : '';
                return (
                  <tr
                    key={quote.id}
                    className={[
                      TABLE_ROW_CLASS_PLAIN,
                      quote.deletedAt ? 'bg-rose-50/30 border-rose-300' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                  >
                    <td
                      className={`${TABLE_CELL_CLASS_SM} align-top font-semibold text-slate-900 ${deletedTextClass}`}
                    >
                      {quote.insuranceType}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_SM} align-top ${deletedTextClass}`}>
                      <ColoredLabel
                        value={quote.insuranceCompany}
                        fallback="-"
                        showDot
                        className={`text-slate-600 ${deletedTextClass}`}
                      />
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS_SM} align-top text-slate-900 whitespace-nowrap ${deletedTextClass}`}
                    >
                      {formatCurrency(String(quote.sumInsured))}
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS_SM} align-top text-slate-900 whitespace-nowrap ${deletedTextClass}`}
                    >
                      {formatCurrency(String(quote.premium))}
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS_SM} align-top text-slate-900 whitespace-nowrap ${deletedTextClass}`}
                    >
                      {quote.deductible || '-'}
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS_SM} align-top text-slate-600 ${deletedTextClass}`}
                    >
                      {quote.comments || '-'}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_SM} align-top ${deletedTextClass}`}>
                      <ColoredLabel
                        value={quote.sellerName || quote.sellerId}
                        fallback="-"
                        showDot={false}
                        className={`text-slate-600 ${deletedTextClass}`}
                      />
                    </td>
                    <td
                      className={`${TABLE_CELL_CLASS_SM} align-top text-slate-600 whitespace-nowrap ${deletedTextClass}`}
                    >
                      {formatDate(quote.createdAt)}
                    </td>
                    <td className={`${TABLE_CELL_CLASS_SM} align-top whitespace-nowrap`}>
                      <div className={TABLE_ACTIONS_CLASS_ROW}>
                        <button
                          className="link-action text-xs"
                          onClick={() => onRequestEditQuote(quote)}
                          type="button"
                        >
                          Редактировать
                        </button>
                        <button
                          className="link-danger text-xs"
                          onClick={() =>
                            onDeleteQuote(String(selectedDeal.id), String(quote.id)).catch(
                              () => undefined,
                            )
                          }
                          type="button"
                        >
                          Удалить
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};
