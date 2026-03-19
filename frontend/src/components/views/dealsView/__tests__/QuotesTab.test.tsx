import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Deal, Quote } from '../../../../types';
import { QuotesTab } from '../tabs/QuotesTab';

const selectedDeal: Deal = {
  id: 'deal-1',
  title: 'Сделка',
  clientId: 'client-1',
  status: 'open',
  createdAt: '2026-01-01T00:00:00Z',
  quotes: [],
  documents: [],
};

const buildQuote = (overrides: Partial<Quote> = {}): Quote => ({
  id: overrides.id ?? 'quote-1',
  dealId: overrides.dealId ?? 'deal-1',
  sellerId: overrides.sellerId ?? null,
  sellerName: overrides.sellerName ?? 'Менеджер',
  insuranceCompanyId: overrides.insuranceCompanyId ?? 'company-1',
  insuranceCompany: overrides.insuranceCompany ?? 'Компания',
  insuranceTypeId: overrides.insuranceTypeId ?? 'type-1',
  insuranceType: overrides.insuranceType ?? 'Каско',
  sumInsured: overrides.sumInsured ?? 1000000,
  premium: overrides.premium ?? 50000,
  deductible: overrides.deductible ?? null,
  officialDealer: overrides.officialDealer ?? false,
  gap: overrides.gap ?? false,
  comments: overrides.comments,
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00Z',
  deletedAt: overrides.deletedAt ?? null,
});

describe('QuotesTab', () => {
  it('форматирует франшизу как рубли и сортирует её как число', () => {
    render(
      <QuotesTab
        selectedDeal={selectedDeal}
        quotes={[
          buildQuote({ id: 'quote-1', insuranceCompany: 'Компания 1', deductible: 300000 }),
          buildQuote({ id: 'quote-2', insuranceCompany: 'Компания 2', deductible: 200000 }),
          buildQuote({ id: 'quote-3', insuranceCompany: 'Компания 3', deductible: null }),
        ]}
        onRequestAddQuote={vi.fn()}
        onRequestEditQuote={vi.fn()}
        onDeleteQuote={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText(/300\s000,00\s₽/)).toBeInTheDocument();
    expect(screen.getByText(/200\s000,00\s₽/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /сортировать по: франшиза/i }));

    const rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('Компания 3')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Компания 2')).toBeInTheDocument();
    expect(within(rows[2]).getByText('Компания 1')).toBeInTheDocument();
  });
});
