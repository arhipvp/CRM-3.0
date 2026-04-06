import type { ComponentProps } from 'react';
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

const renderForm = (
  initialValues: PolicyFormValues,
  overrides?: Partial<ComponentProps<typeof AddPolicyForm>>,
) =>
  render(
    <AddPolicyForm
      onSubmit={vi.fn().mockResolvedValue(undefined)}
      onCancel={vi.fn()}
      salesChannels={[]}
      initialValues={initialValues}
      clients={[]}
      onRequestAddClient={vi.fn()}
      isEditing
      {...overrides}
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
    fireEvent.click(screen.getByTestId('policy-payment-index-2'));
    expect(screen.getByTestId('policy-payment-index-2').className).toContain('bg-sky-100');

    const paymentCards = within(screen.getByTestId('policy-payment-list')).getAllByTestId(
      'policy-payment-card',
    );
    expect(within(paymentCards[0]).getByTestId('policy-payment-expand-toggle').className).toContain(
      'w-full',
    );
    fireEvent.click(within(paymentCards[0]).getByRole('button', { name: 'Развернуть' }));
    await waitFor(() => {
      expect(
        within(paymentCards[0]).getByTestId('policy-payment-amount-accent'),
      ).toBeInTheDocument();
    });
    expect(
      within(paymentCards[0]).getByTestId('policy-payment-scheduled-date-accent'),
    ).toBeInTheDocument();
    expect(
      within(paymentCards[0]).getByTestId('policy-payment-actual-date-accent'),
    ).toBeInTheDocument();
    expect(
      within(paymentCards[1]).queryByTestId('policy-payment-amount-accent'),
    ).not.toBeInTheDocument();

    fireEvent.click(within(paymentCards[2]).getByRole('button', { name: 'Развернуть' }));
    await waitFor(() => {
      expect(
        within(paymentCards[2]).getByTestId('policy-payment-amount-accent'),
      ).toBeInTheDocument();
    });
    expect(
      within(paymentCards[0]).queryByTestId('policy-payment-amount-accent'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);
    const scheduledDates = paymentCards.map((card) => {
      const toggleButton = within(card).getByTestId('policy-payment-expand-toggle');
      if (toggleButton.getAttribute('aria-expanded') !== 'true') {
        fireEvent.click(toggleButton);
      }
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
          incomes: [{ amount: '2500', date: '2026-04-14', note: 'Комиссия' }],
          expenses: [{ amount: '500', date: '2026-04-15', note: 'Списание' }],
        },
        {
          amount: '16859.00',
          description: 'Июль',
          scheduledDate: '2026-07-12',
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
    expect(financeText[2]).toContain('Июль');
    expect(financeText[3]).toContain('Октябрь');
    expect(screen.getByTestId('policy-finance-payment-mini-index')).toBeInTheDocument();
    expect(screen.getByTestId('policy-finance-payment-list').className).toContain(
      'overflow-y-auto',
    );
    expect(screen.getAllByTestId('policy-finance-payment-expand-toggle')[0].className).toContain(
      'w-full',
    );
    expect(screen.getAllByTestId('policy-finance-payment-amount-chip')[0]).toBeInTheDocument();
    expect(screen.getAllByTestId('policy-finance-payment-scheduled-chip')[0]).toBeInTheDocument();
    expect(screen.getAllByTestId('policy-finance-payment-actual-chip')[0]).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('policy-finance-payment-index-3'));
    expect(screen.getByTestId('policy-finance-payment-index-3').className).toContain('bg-sky-100');

    const expandButtons = screen.getAllByRole('button', { name: 'Развернуть' });
    fireEvent.click(expandButtons[2]);
    expect(
      screen.getByText('Добавьте доход, чтобы привязать поступление к этому платежу.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('policy-finance-payment-index-3').className).toContain('bg-sky-100');

    fireEvent.click(screen.getAllByRole('button', { name: 'Развернуть' })[0]);

    expect(
      screen.getByText('Добавьте доход, чтобы привязать поступление к этому платежу.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { expanded: true })).toHaveLength(1);

    fireEvent.click(within(financeCards[1]).getByRole('button', { name: 'Развернуть' }));
    await waitFor(() => {
      expect(screen.getAllByTestId('incomes-record-amount-accent')[0]).toBeInTheDocument();
    });
    expect(screen.getAllByTestId('incomes-record-date-accent')[0]).toBeInTheDocument();
    expect(screen.getAllByTestId('expenses-record-amount-accent')[0]).toBeInTheDocument();
    expect(screen.getAllByTestId('expenses-record-date-accent')[0]).toBeInTheDocument();
  });

  it('keeps the same expanded payment when switching from payments to finance step', async () => {
    renderForm(
      buildInitialValues([
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
          incomes: [{ amount: '2500', date: '2026-04-14', note: 'Комиссия' }],
          expenses: [],
        },
      ]),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Платежи и сроки' }));
    const paymentCards = await waitFor(() => screen.getAllByTestId('policy-payment-card'));
    fireEvent.click(within(paymentCards[1]).getByRole('button', { name: 'Развернуть' }));

    await waitFor(() => {
      expect(
        within(paymentCards[1]).getByTestId('policy-payment-amount-accent'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Контрагенты и финансы' }));

    const financeCards = await waitFor(() => screen.getAllByTestId('policy-finance-payment-card'));
    expect(within(financeCards[1]).getByRole('button', { name: 'Свернуть' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getAllByTestId('incomes-record-amount-accent')[0]).toBeInTheDocument();
  });

  it('shows inline payment errors, allows early actual dates, and reports dirty state', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onDirtyChange = vi.fn();

    renderForm(
      buildInitialValues([
        {
          amount: '0',
          description: '',
          scheduledDate: '2028-02-01',
          actualDate: '2028-01-01',
          incomes: [],
          expenses: [],
        },
      ]),
      { onSubmit, onDirtyChange },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Платежи и сроки' }));

    await waitFor(() => {
      expect(screen.getByTestId('policy-payment-issues')).toBeInTheDocument();
    });
    expect(screen.getByTestId('policy-payment-issues')).toHaveTextContent(
      'Укажите сумму больше нуля.',
    );
    expect(screen.getByTestId('policy-payment-issues')).not.toHaveTextContent(
      'Фактическая дата не может быть раньше плановой.',
    );
    expect(screen.getByTestId('policy-payment-issues')).not.toHaveTextContent(
      'Добавьте комментарий, чтобы проще различать платежи в длинном графике.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Контрагенты и финансы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить полис' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(
      screen.getByText('Исправьте ошибки в платежах перед сохранением полиса.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Платежи и сроки' }));
    fireEvent.change(screen.getByDisplayValue('0'), { target: { value: '15000' } });

    await waitFor(() => {
      expect(screen.getByTestId('policy-form-dirty-badge')).toBeInTheDocument();
    });
    expect(onDirtyChange).toHaveBeenCalledWith(true);
  });

  it('allows saving with an early actual date and no comment warnings', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderForm(
      buildInitialValues([
        {
          amount: '16859.00',
          description: '',
          scheduledDate: '2026-04-27',
          actualDate: '2026-04-04',
          incomes: [],
          expenses: [],
        },
      ]),
      { onSubmit },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Платежи и сроки' }));

    await waitFor(() => {
      expect(screen.getByTestId('policy-payment-card')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('policy-payment-issues')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Контрагенты и финансы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить полис' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });

  it('allows saving when there are only warnings', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    renderForm(
      buildInitialValues([
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
          scheduledDate: '2026-01-13',
          actualDate: '',
          incomes: [],
          expenses: [],
        },
      ]),
      { onSubmit },
    );

    fireEvent.click(screen.getByRole('button', { name: 'Контрагенты и финансы' }));
    fireEvent.click(screen.getByRole('button', { name: 'Сохранить полис' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
