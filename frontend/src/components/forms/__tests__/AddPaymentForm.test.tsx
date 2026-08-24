import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AddPaymentForm } from '../AddPaymentForm';
import type { Policy } from '../../../types';

const policy: Policy = {
  id: 'policy-1',
  number: 'POL-001',
  insuranceCompanyId: 'company-1',
  insuranceCompany: 'Компания',
  insuranceTypeId: 'type-1',
  insuranceType: 'Ипотека',
  dealId: 'deal-1',
  isVehicle: false,
  counterparty: 'Партнёр',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
};

describe('AddPaymentForm', () => {
  it('creates the same default financial drafts as the policy form and submits them', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <AddPaymentForm
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        dealId="deal-1"
        policies={[policy]}
        fixedPolicyId={policy.id}
      />,
    );

    expect(screen.getByText('Финансовые записи')).toBeInTheDocument();
    expect(screen.getByText('Доход #1')).toBeInTheDocument();
    expect(screen.getByText('Расход #1')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Сумма (руб.) *'), { target: { value: '1000' } });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        policyId: policy.id,
        dealId: 'deal-1',
        incomes: [expect.objectContaining({ amount: '0' })],
        expenses: [expect.objectContaining({ amount: '1', note: 'Расход контрагенту Партнёр' })],
      }),
    );
  });

  it('does not show creation-only financial drafts while editing a payment', () => {
    render(
      <AddPaymentForm
        payment={{
          id: 'payment-1',
          amount: '1000',
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-01T00:00:00Z',
        }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.queryByText('Финансовые записи')).not.toBeInTheDocument();
  });
});
