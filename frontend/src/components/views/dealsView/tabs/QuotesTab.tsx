import React from 'react';
import type { Deal, Quote } from '../../../../types';
import { formatCurrency, formatDate } from '../helpers';

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
  if (!selectedDeal) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-base font-semibold text-slate-800">Предложенные продукты</h3>
        <button
          onClick={() => onRequestAddQuote(selectedDeal.id)}
          className="px-3 py-2 text-sm font-semibold text-sky-600 hover:text-sky-800"
        >
          + Добавить расчёт
        </button>
      </div>
      {!quotes.length ? (
        <p className="text-sm text-slate-500">Расчётов пока нет.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white">
          <table className="min-w-full text-sm text-left">
            <thead className="text-[10px] uppercase tracking-[0.2em] text-slate-500 bg-slate-50">
              <tr>
                <th className="px-4 py-3">Тип</th>
                <th className="px-4 py-3">Компания</th>
                <th className="px-4 py-3">Сумма</th>
                <th className="px-4 py-3">Премия</th>
                <th className="px-4 py-3">Франшиза</th>
                <th className="px-4 py-3">Комментарии</th>
                <th className="px-4 py-3">Добавлен</th>
                <th className="px-4 py-3">??? ???????</th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((quote) => (
                <tr key={quote.id} className="odd:bg-white even:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-900">{quote.insuranceType}</td>
                  <td className="px-4 py-3 text-slate-600">{quote.insuranceCompany || '—'}</td>
                  <td className="px-4 py-3 text-slate-900">{formatCurrency(String(quote.sumInsured))}</td>
                  <td className="px-4 py-3 text-slate-900">{formatCurrency(String(quote.premium))}</td>
                  <td className="px-4 py-3 text-slate-900">{quote.deductible || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{quote.comments || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{quote.sellerName || quote.sellerId || '-'}</td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(quote.createdAt)}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button
                      className="text-xs font-semibold text-sky-600 hover:text-sky-800"
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
    </div>
  );
};
