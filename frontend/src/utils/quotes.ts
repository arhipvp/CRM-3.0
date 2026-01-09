import type { Quote } from '../types';

export function markQuoteAsDeleted(quotes: Quote[], quoteId: string, deletedAt?: string): Quote[] {
  const resolvedDeletedAt = deletedAt ?? new Date().toISOString();
  return quotes.map((quote) =>
    quote.id === quoteId && !quote.deletedAt ? { ...quote, deletedAt: resolvedDeletedAt } : quote,
  );
}
