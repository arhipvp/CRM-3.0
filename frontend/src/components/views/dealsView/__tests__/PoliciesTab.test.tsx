import type React from 'react';
import { render, screen } from '@testing-library/react';
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
  clientId: overrides.clientId ?? 'client-1',
  clientName: overrides.clientName ?? 'Client',
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
  it('renders compact table without summary blocks and with readable problem status', () => {
    setup({
      relatedPayments: [
        buildPayment({
          id: 'payment-1',
          amount: '2100',
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
            {
              id: 'record-unpaid',
              paymentId: 'payment-1',
              amount: '-30',
              recordType: 'Расход',
              note: '',
              date: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
        buildPayment({ id: 'payment-2', amount: '3500', actualDate: null }),
      ],
    });

    expect(screen.getByText('Примечание')).toBeInTheDocument();
    expect(screen.getByText('Платежи')).toBeInTheDocument();
    expect(screen.getByText('Финзаписи')).toBeInTheDocument();

    const statusBadge = screen.getByText('Есть неоплаченные записи');
    expect(statusBadge).toHaveAttribute(
      'title',
      'Есть финансовые записи без даты оплаты по платежам полиса',
    );

    const noteCell = screen.getByText('Тестовое примечание');
    expect(noteCell).toHaveAttribute('title', 'Тестовое примечание');

    const paidPaymentRow = screen.getByTitle(
      (title) => title.includes('02.01.2025') && title.includes('2'),
    );
    const unpaidPaymentRow = screen.getByTitle(
      (title) => title.includes('без даты оплаты') && title.includes('₽'),
    );
    expect(paidPaymentRow.className).toContain('bg-emerald-50');
    expect(unpaidPaymentRow.className).toContain('bg-rose-50');

    const paidRecordRow = screen.getByTitle(
      (title) => title.includes('03.01.2025') && title.includes('Комиссия'),
    );
    const unpaidRecordRow = screen.getByTitle(
      (title) => title.includes('без даты выплаты') && title.includes('Оплата от клиента'),
    );
    expect(paidRecordRow.className).toContain('bg-emerald-50');
    expect(unpaidRecordRow.className).toContain('bg-rose-50');

    expect(screen.queryByText('Основное')).toBeNull();
    expect(screen.queryByText('Сроки')).toBeNull();
    expect(screen.queryByText('Финансы')).toBeNull();
  });

  it('shows empty fallback when deal has no policies', () => {
    setup({ sortedPolicies: [] });
    expect(screen.getByText('Для сделки пока нет полисов.')).toBeInTheDocument();
  });
});
