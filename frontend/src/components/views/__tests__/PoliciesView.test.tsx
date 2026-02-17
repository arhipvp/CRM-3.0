import type { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Payment, Policy } from '../../../types';
import { PoliciesView } from '../PoliciesView';
import { vi } from 'vitest';
import { NotificationProvider } from '../../../contexts/NotificationProvider';

type PaymentCardProps = ComponentProps<
  (typeof import('../../policies/PaymentCard'))['PaymentCard']
>;

const paymentCardMockProps: PaymentCardProps[] = [];
vi.mock('../../policies/PaymentCard', () => ({
  PaymentCard: (props: PaymentCardProps) => {
    paymentCardMockProps.push(props);
    return (
      <tr
        data-testid={`payment-card-${props.payment.id}`}
        data-variant={props.variant ?? 'default'}
      >
        <td>{props.payment.id}</td>
      </tr>
    );
  },
}));

const buildPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: overrides.id ?? 'policy-1',
  number: overrides.number ?? 'POL-1',
  dealId: overrides.dealId ?? 'deal-1',
  insuranceCompany: overrides.insuranceCompany ?? 'Alpha',
  insuranceCompanyId: overrides.insuranceCompanyId ?? 'company-1',
  insuranceType: overrides.insuranceType ?? 'OSAGO',
  insuranceTypeId: overrides.insuranceTypeId ?? 'type-1',
  isVehicle: overrides.isVehicle ?? false,
  brand: overrides.brand ?? 'Brand',
  model: overrides.model ?? 'Model',
  vin: overrides.vin ?? 'VIN1',
  status: overrides.status ?? 'active',
  startDate: overrides.startDate ?? '2025-01-01',
  endDate: overrides.endDate ?? '2025-12-31',
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  paymentsPaid: overrides.paymentsPaid ?? '100',
  paymentsTotal: overrides.paymentsTotal ?? '100',
  counterparty: overrides.counterparty ?? '',
  clientId: overrides.clientId ?? 'client-1',
  clientName: overrides.clientName ?? 'Client',
  driveFolderId: overrides.driveFolderId ?? null,
});

const buildPayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: overrides.id ?? 'payment-1',
  policyId: overrides.policyId ?? 'policy-1',
  amount: overrides.amount ?? '100',
  description: overrides.description,
  note: overrides.note,
  scheduledDate: overrides.scheduledDate ?? null,
  actualDate: overrides.actualDate ?? null,
  financialRecords: overrides.financialRecords,
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
});

const defaultProps = {
  onRequestEditPolicy: vi.fn(),
  onAddFinancialRecord: vi.fn(),
  onUpdateFinancialRecord: vi.fn(),
  onDeleteFinancialRecord: vi.fn(),
  onDeletePayment: vi.fn(),
};

describe('PoliciesView', () => {
  beforeEach(() => {
    paymentCardMockProps.length = 0;
  });

  it('filters to only unpaid policies', async () => {
    const policies = [
      buildPolicy({ id: 'policy-one', number: 'POL-ONE' }),
      buildPolicy({ id: 'policy-two', number: 'POL-TWO' }),
    ];
    const payments: Payment[] = [
      buildPayment({ id: 'payment-1', policyId: 'policy-one', actualDate: '' }),
      buildPayment({
        id: 'payment-2',
        policyId: 'policy-two',
        actualDate: '2025-01-01',
        financialRecords: [
          {
            id: 'r-1',
            paymentId: 'payment-2',
            amount: '100',
            date: '2025-01-02',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      }),
    ];

    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView policies={policies} payments={payments} {...defaultProps} />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('POL-ONE')).toBeInTheDocument();
    expect(screen.getByText('POL-TWO')).toBeInTheDocument();

    const checkbox = screen.getByLabelText('Только с неоплаченными платежами');
    fireEvent.click(checkbox);

    expect(screen.getByText('POL-ONE')).toBeInTheDocument();
    expect(screen.queryByText('POL-TWO')).toBeNull();
  });

  it('renders payments expanded by default', () => {
    const policies = [buildPolicy({ id: 'policy-one', number: 'POL-ONE' })];
    const payments: Payment[] = [
      buildPayment({ id: 'payment-1', policyId: 'policy-one', actualDate: '' }),
    ];

    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView policies={policies} payments={payments} {...defaultProps} />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getAllByText('Сумма').length).toBeGreaterThan(1);
    expect(screen.getByText('Доходы')).toBeInTheDocument();
    expect(screen.getByText('Расходы')).toBeInTheDocument();
    const paymentCard = screen.getByTestId('payment-card-payment-1');
    expect(paymentCard.dataset.variant).toBe('table-row');
    expect(screen.queryByText('Раскрыть все')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Платежи (1)' })).toBeNull();
  });

  it('shows empty state when no policies', () => {
    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView policies={[]} payments={[]} {...defaultProps} />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Нет полисов для отображения')).toBeInTheDocument();
  });
});
