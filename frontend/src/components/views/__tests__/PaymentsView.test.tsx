import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Payment } from '../../../types';
import { PaymentsView } from '../PaymentsView';

const buildPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: overrides.id ?? 'payment-1',
  dealId: overrides.dealId ?? 'deal-1',
  dealTitle: overrides.dealTitle ?? 'Сделка',
  dealClientName: overrides.dealClientName ?? 'Иван Иванов',
  amount: overrides.amount ?? '1234567.89',
  scheduledDate: overrides.scheduledDate ?? '2026-04-15',
  actualDate: overrides.actualDate ?? null,
  createdAt: overrides.createdAt ?? '2026-04-01T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2026-04-01T00:00:00Z',
  ...overrides,
});

describe('PaymentsView', () => {
  it('renders payment amounts with spaces and a ruble sign', () => {
    render(<PaymentsView payments={[buildPayment()]} onMarkPaid={vi.fn()} />);

    expect(screen.getByText('1 234 567,89 ₽')).toBeInTheDocument();
  });
});
