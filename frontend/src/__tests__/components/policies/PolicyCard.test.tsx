import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import type { Policy } from '../../../types';
import { PolicyCard } from '../../../components/policies/PolicyCard';
import type { PolicyCardModel } from '../../../components/policies/policyCardModel';
import { NotificationProvider } from '../../../contexts/NotificationProvider';

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
  note: 'Без примечания',
  paymentsCount: 0,
  paymentsCountLabel: '0 записей',
  dealId: 'd1',
  clientId: null,
});

describe('PolicyCard', () => {
  it('invokes action button handler', async () => {
    const onAction = vi.fn();
    const user = userEvent.setup();

    render(
      <NotificationProvider>
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
          actions={[{ key: 'edit', label: 'Edit', onClick: onAction }]}
        />
      </NotificationProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
