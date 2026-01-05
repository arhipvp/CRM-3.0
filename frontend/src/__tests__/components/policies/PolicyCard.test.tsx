import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Policy } from '../../../types';
import { PolicyCard } from '../../../components/policies/PolicyCard';
import type { PolicyCardModel } from '../../../components/policies/policyCardModel';

const createPolicy = (): Policy => ({
  id: 'p1',
  number: 'POL-1',
  insuranceCompanyId: 'c1',
  insuranceCompany: 'Alpha',
  insuranceTypeId: 't1',
  insuranceType: 'OSAGO',
  dealId: 'd1',
  isVehicle: false,
  status: 'active',
  createdAt: '2020-01-01',
  updatedAt: '2020-01-01',
});

const createModel = (): PolicyCardModel => ({
  number: 'POL-1',
  startDate: '-',
  endDate: '-',
  client: 'Client',
  insuranceCompany: 'Alpha',
  salesChannel: '-',
  sum: '—',
  insuranceType: 'OSAGO',
  brand: '—',
  model: '—',
  vin: '—',
  paymentsCount: 0,
  paymentsCountLabel: '0 записей',
  dealId: 'd1',
  clientId: null,
});

describe('PolicyCard', () => {
  it('invokes primaryAction when clicking the header', async () => {
    const onPrimary = vi.fn();
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(
      <PolicyCard
        policy={createPolicy()}
        payments={[]}
        model={createModel()}
        recordsExpandedAll={false}
        isPaymentsExpanded={false}
        onTogglePaymentsExpanded={() => undefined}
        onRequestAddRecord={() => undefined}
        onEditFinancialRecord={() => undefined}
        onDeleteFinancialRecord={async () => undefined}
        primaryAction={{ label: 'Open', onClick: onPrimary }}
        actions={[{ key: 'edit', label: 'Edit', onClick: onAction }]}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});
