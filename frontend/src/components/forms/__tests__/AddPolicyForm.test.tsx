import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AddPolicyForm } from '../AddPolicyForm';
import type { PolicyFormValues } from '../addPolicy/types';

vi.mock('../../../api', () => ({
  fetchInsuranceCompanies: vi.fn().mockResolvedValue([]),
  fetchInsuranceTypes: vi.fn().mockResolvedValue([]),
  fetchVehicleBrands: vi.fn().mockResolvedValue([]),
  fetchVehicleModels: vi.fn().mockResolvedValue([]),
}));

const buildInitialValues = (payments: PolicyFormValues['payments']): PolicyFormValues => ({
  number: 'POL-001',
  insuranceCompanyId: 'company-1',
  insuranceTypeId: 'type-1',
  isVehicle: false,
  startDate: '2026-01-13',
  endDate: '2027-01-12',
  payments,
});

const renderForm = (initialValues: PolicyFormValues) =>
  render(
    <AddPolicyForm
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      onCancel={vi.fn()}
      salesChannels={[]}
      initialValues={initialValues}
      clients={[]}
      onRequestAddClient={vi.fn()}
      isEditing
    />,
  );

describe('AddPolicyForm', () => {
  it('renders a constrained body, shows mini index for long lists, and sorts payments by scheduled date', async () => {
    renderForm(
      buildInitialValues([
        {
          amount: '16859.00',
          description: '',
          scheduledDate: '2026-10-10',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
        {
          amount: '16859.00',
          description: '',
          scheduledDate: '2026-04-13',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
        {
          amount: '16859.00',
          description: '',
          scheduledDate: '2026-01-13',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
        {
          amount: '16859.00',
          description: '',
          scheduledDate: '2026-07-12',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Платежи и сроки' }));

    const formBody = screen.getByTestId('policy-form-body');
    const formFooter = screen.getByTestId('policy-form-footer');
    expect(formBody.className).toContain('overflow-y-auto');
    expect(formFooter.className).toContain('border-t');
    expect(
      screen.queryByText('Плановые даты идут по порядку, чтобы график было проще проверить.'),
    ).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByTestId('policy-payment-card')).toHaveLength(4);
    });
    expect(screen.getByTestId('policy-payment-mini-index')).toBeInTheDocument();

    const paymentCards = within(screen.getByTestId('policy-payment-list')).getAllByTestId(
      'policy-payment-card',
    );
    const scheduledDates = paymentCards.map((card) => {
      const input = card.querySelector('[data-payment-field="scheduled-date"]') as HTMLInputElement;
      return input.value;
    });

    expect(scheduledDates).toEqual(['2026-01-13', '2026-04-13', '2026-07-12', '2026-10-10']);
  });

  it('computes the first payment warning using the earliest scheduled date instead of raw array order', async () => {
    renderForm(
      buildInitialValues([
        {
          amount: '16859.00',
          description: '',
          scheduledDate: '2026-10-10',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
        {
          amount: '16859.00',
          description: '',
          scheduledDate: '2026-01-13',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Платежи и сроки' }));

    await waitFor(() => {
      expect(screen.getAllByTestId('policy-payment-card')).toHaveLength(2);
    });

    expect(
      screen.queryByText(
        'Дата первого платежа не совпадает с началом полиса. Проверьте расписание.',
      ),
    ).not.toBeInTheDocument();
  });

  it('keeps finance step in chronological order and allows only one expanded payment at a time', async () => {
    renderForm(
      buildInitialValues([
        {
          amount: '16859.00',
          description: 'Октябрь',
          scheduledDate: '2026-10-10',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
        {
          amount: '16859.00',
          description: 'Январь',
          scheduledDate: '2026-01-13',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
        {
          amount: '16859.00',
          description: 'Апрель',
          scheduledDate: '2026-04-13',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Контрагенты и финансы' }));

    const financeCards = await waitFor(() => screen.getAllByTestId('policy-finance-payment-card'));
    const financeText = financeCards.map((card) => card.textContent ?? '');

    expect(financeText[0]).toContain('Январь');
    expect(financeText[1]).toContain('Апрель');
    expect(financeText[2]).toContain('Октябрь');

    const expandButtons = screen.getAllByRole('button', { name: 'Развернуть' });
    fireEvent.click(expandButtons[0]);
    expect(
      screen.getByText('Добавьте доход, чтобы привязать поступление к этому платежу.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Развернуть' })[1]);

    expect(
      screen.getByText('Добавьте доход, чтобы привязать поступление к этому платежу.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
  });
});
