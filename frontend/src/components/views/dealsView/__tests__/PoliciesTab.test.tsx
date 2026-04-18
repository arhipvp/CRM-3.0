import type React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { Client, Deal, Payment, Policy } from '../../../../types';
import { PoliciesTab } from '../tabs/PoliciesTab';

const buildDeal = (): Deal => ({
  id: 'deal-1',
  title: 'Сделка',
  clientId: 'client-1',
  clientName: 'Клиент',
  status: 'open',
  createdAt: new Date().toISOString(),
  quotes: [],
  documents: [],
});

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
  computedStatus: overrides.computedStatus ?? 'problem',
  startDate: overrides.startDate ?? '2025-01-01',
  endDate: overrides.endDate ?? '2025-12-31',
  createdAt: overrides.createdAt ?? new Date().toISOString(),
  updatedAt: overrides.updatedAt ?? new Date().toISOString(),
  paymentsPaid: overrides.paymentsPaid ?? '120',
  paymentsTotal: overrides.paymentsTotal ?? '300',
  counterparty: overrides.counterparty ?? '',
  dealTitle: overrides.dealTitle ?? 'Сделка #1',
  clientId: overrides.clientId ?? 'client-1',
  clientName: overrides.clientName ?? 'Client',
  salesChannel: overrides.salesChannel ?? '',
  driveFolderId: overrides.driveFolderId ?? null,
  note: overrides.note ?? '',
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

const setup = (overrides: Partial<React.ComponentProps<typeof PoliciesTab>> = {}) => {
  const setCreatingFinancialRecordContext = vi.fn();

  return render(
    <PoliciesTab
      selectedDeal={buildDeal()}
      sortedPolicies={[buildPolicy({ note: 'Тестовое примечание' })]}
      relatedPayments={[buildPayment()]}
      clients={[] as Client[]}
      onOpenClient={vi.fn()}
      policySortKey="startDate"
      policySortOrder="asc"
      setPolicySortKey={vi.fn()}
      setPolicySortOrder={vi.fn()}
      setEditingPaymentId={vi.fn()}
      setCreatingPaymentPolicyId={vi.fn()}
      setCreatingFinancialRecordContext={setCreatingFinancialRecordContext}
      setEditingFinancialRecordId={vi.fn()}
      onDeleteFinancialRecord={vi.fn().mockResolvedValue(undefined)}
      onDeletePayment={vi.fn().mockResolvedValue(undefined)}
      onRequestAddPolicy={vi.fn()}
      onDeletePolicy={vi.fn().mockResolvedValue(undefined)}
      onRequestEditPolicy={vi.fn()}
      {...overrides}
    />,
  );
};

describe('PoliciesTab', () => {
  it('renders hierarchical ledger layout and readable problem status', () => {
    const onDealSelect = vi.fn();
    setup({
      onDealSelect,
      relatedPayments: [
        buildPayment({
          id: 'payment-1',
          amount: '2100',
          scheduledDate: '2025-02-28',
          actualDate: '2025-01-02',
          note: 'Оплата от клиента',
          financialRecords: [
            {
              id: 'record-paid',
              paymentId: 'payment-1',
              amount: '100',
              recordType: 'Доход',
              note: 'Комиссия',
              date: '2025-01-03',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        buildPayment({
          id: 'payment-2',
          amount: '3500',
          scheduledDate: null,
          actualDate: null,
          financialRecords: [
            {
              id: 'record-unpaid',
              paymentId: 'payment-2',
              amount: '-30',
              recordType: 'Расход',
              note: '',
              date: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ],
      sortedPolicies: [
        buildPolicy({
          note: 'Тестовое примечание',
          salesChannel: 'Марьинских',
          dealTitle: 'Сделка #1',
        }),
      ],
    });

    expect(screen.getByText('Номер полиса')).toBeInTheDocument();
    expect(screen.getByText('Основные данные')).toBeInTheDocument();
    expect(screen.getByText('Платеж')).toBeInTheDocument();
    expect(screen.getByText('Финансовые записи')).toBeInTheDocument();
    expect(screen.queryByText('Оплачено / План')).toBeNull();

    const statusBadge = screen.getByText('Есть неоплаченные записи');
    expect(statusBadge).toHaveAttribute(
      'title',
      'Есть финансовые записи без даты оплаты по платежам полиса',
    );

    const policyCell = screen.getByText('POL-1').closest('td');
    expect(policyCell?.getAttribute('rowspan')).toBe('2');

    const paidPaymentRow = screen.getByTitle(
      (title) => title.includes('28.02.2025') && title.includes('2'),
    );
    const unpaidPaymentRow = screen.getByTitle(
      (title) => title.includes('без плановой даты') && title.includes('₽'),
    );
    expect(paidPaymentRow.className).toContain('bg-emerald-50');
    expect(unpaidPaymentRow.className).toContain('bg-rose-50');

    const paidRecordRow = screen.getByTitle(
      (title) => title.includes('03.01.2025') && title.includes('Комиссия'),
    );
    const unpaidRecordRow = screen.getByTitle(
      (title) => title.includes('без даты выплаты') && title.includes('Без комментария'),
    );
    expect(paidRecordRow.className).toContain('bg-emerald-50');
    expect(unpaidRecordRow.className).toContain('bg-rose-50');
    expect(screen.getByTitle('Alpha, OSAGO, Марьинских')).toBeInTheDocument();
    const companyMeta = screen.getByText('Alpha').closest('p');
    expect(companyMeta?.querySelector('span.rounded-full')).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Сделка #1' }));
    expect(onDealSelect).toHaveBeenCalledWith('deal-1');
  });

  it('renders deal title as plain text when no callbacks provided', () => {
    setup({
      sortedPolicies: [buildPolicy({ dealTitle: 'Сделка без клика' })],
    });

    expect(screen.getByText('Сделка без клика')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Сделка без клика' })).toBeNull();
  });

  it('shows empty fallback when deal has no policies', () => {
    setup({ sortedPolicies: [] });
    expect(screen.getByText('Для сделки пока нет полисов.')).toBeInTheDocument();
  });

  it('marks payment as paid only after date selection and confirmation', async () => {
    const onMarkPaymentPaid = vi.fn().mockResolvedValue(undefined);

    setup({
      onMarkPaymentPaid,
      relatedPayments: [
        buildPayment({
          id: 'payment-to-mark',
          scheduledDate: '2025-02-28',
          actualDate: null,
        }),
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Проставить оплату' }));
    fireEvent.change(screen.getByLabelText('Дата оплаты'), {
      target: { value: '2026-05-12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Проставить дату' }));

    await waitFor(() => {
      expect(onMarkPaymentPaid).toHaveBeenCalledWith('payment-to-mark', '2026-05-12');
    });
  });

  it('marks financial record as paid only after date selection and confirmation', async () => {
    const onMarkFinancialRecordPaid = vi.fn().mockResolvedValue(undefined);

    setup({
      onMarkFinancialRecordPaid,
      relatedPayments: [
        buildPayment({
          id: 'payment-with-record',
          scheduledDate: '2025-02-28',
          actualDate: '2025-02-28',
          financialRecords: [
            {
              id: 'record-to-mark',
              paymentId: 'payment-with-record',
              amount: '0',
              recordType: 'Доход',
              note: 'Комиссия',
              date: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ],
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Проставить оплату' })[0]);
    fireEvent.change(screen.getByLabelText('Дата оплаты'), {
      target: { value: '2026-05-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Продолжить' }));
    fireEvent.click(screen.getByRole('button', { name: 'Проставить дату' }));

    await waitFor(() => {
      expect(onMarkFinancialRecordPaid).toHaveBeenCalledWith('record-to-mark', '2026-05-15');
    });
  });

  it('hides financial record quick actions for records in statements', () => {
    setup({
      relatedPayments: [
        buildPayment({
          id: 'payment-with-statement-record',
          actualDate: '2025-02-28',
          financialRecords: [
            {
              id: 'record-in-statement',
              paymentId: 'payment-with-statement-record',
              statementId: 'statement-1',
              amount: '15',
              recordType: 'Доход',
              note: 'Ведомость',
              date: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      ],
    });

    expect(screen.queryByRole('button', { name: 'Удалить запись' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Проставить оплату' })).toBeNull();
  });
});
