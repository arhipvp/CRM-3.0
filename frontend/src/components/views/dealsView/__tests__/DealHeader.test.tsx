import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Deal } from '../../../../types';
import { DealHeader } from '../DealHeader';

const deal: Deal = {
  id: 'deal-1',
  title: 'Deal title',
  clientId: 'client-1',
  clientName: 'Client A',
  status: 'open',
  createdAt: '2024-01-01T00:00:00Z',
  quotes: [],
  documents: [],
};

describe('DealHeader', () => {
  it('renders deal info', () => {
    render(
      <DealHeader
        deal={{ ...deal, description: 'Test description', closingReason: 'Причина' }}
        clientDisplayName="Client A"
        clientPhone="+7 (999) 000-00-01"
        sellerDisplayName="Seller"
        executorDisplayName="Executor"
      />
    );

    expect(screen.getByText('Deal title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
    expect(screen.getByText('Client A')).toBeInTheDocument();
    expect(screen.getByText('Seller')).toBeInTheDocument();
    expect(screen.getByText('Executor')).toBeInTheDocument();
    expect(
      screen.getByText(
        (content) =>
          content.includes('Причина закрытия') && content.includes('Причина')
      )
    ).toBeInTheDocument();
  });

  it('renders WhatsApp icon when the client has a phone', () => {
    render(
      <DealHeader
        deal={deal}
        clientDisplayName="Client A"
        clientPhone="+7 999 000 00 02"
        sellerDisplayName="Seller"
        executorDisplayName="Executor"
      />
    );

    expect(
      screen.getByRole('link', { name: 'Написать клиенту в WhatsApp' })
    ).toHaveAttribute('href', 'https://wa.me/79990000002');
  });

  it('does not render WhatsApp icon when the client phone is missing', () => {
    render(
      <DealHeader
        deal={deal}
        clientDisplayName="Client A"
        sellerDisplayName="Seller"
        executorDisplayName="Executor"
      />
    );

    expect(
      screen.queryByRole('link', { name: 'Написать клиенту в WhatsApp' })
    ).toBeNull();
  });
});
