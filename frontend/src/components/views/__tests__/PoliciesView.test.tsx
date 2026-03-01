import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Payment, Policy } from '../../../types';
import { NotificationProvider } from '../../../contexts/NotificationProvider';
import { PoliciesView } from '../PoliciesView';
import { fetchPoliciesKPI } from '../../../api';

vi.mock('../../../api', async () => {
  const actual = await vi.importActual<typeof import('../../../api')>('../../../api');
  return {
    ...actual,
    fetchPoliciesKPI: vi.fn(async () => ({
      total: 1,
      problemCount: 1,
      dueCount: 0,
      expiringSoonCount: 0,
      expiringDays: 30,
    })),
  };
});

const buildPolicy = (overrides: Partial<Policy> = {}): Policy => ({
  id: overrides.id ?? 'policy-1',
  number: overrides.number ?? 'POL-1',
  dealId: overrides.dealId ?? 'deal-1',
  dealTitle: overrides.dealTitle ?? 'Сделка #1',
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
  paymentsPaid: overrides.paymentsPaid ?? '100',
  paymentsTotal: overrides.paymentsTotal ?? '300',
  counterparty: overrides.counterparty ?? '',
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

describe('PoliciesView', () => {
  beforeEach(() => {
    vi.mocked(fetchPoliciesKPI).mockClear();
  });

  it('renders compact policy meta, scheduled payment date and deal preview link', async () => {
    const onDealPreview = vi.fn();
    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[
              buildPolicy({
                note: 'Длинное примечание',
                computedStatus: 'problem',
                salesChannel: 'Марьинских',
              }),
            ]}
            payments={[
              buildPayment({
                id: 'payment-paid',
                amount: '3000',
                scheduledDate: '2025-02-25',
                actualDate: '2025-01-02',
                note: 'Оплата наличными',
                financialRecords: [
                  {
                    id: 'record-paid',
                    paymentId: 'payment-paid',
                    amount: '200',
                    recordType: 'Доход',
                    note: 'Чаевые',
                    date: '2025-01-03',
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                ],
              }),
              buildPayment({
                id: 'payment-unpaid',
                amount: '5000',
                scheduledDate: null,
                actualDate: null,
                financialRecords: [
                  {
                    id: 'record-unpaid',
                    paymentId: 'payment-unpaid',
                    amount: '-50',
                    recordType: 'Расход',
                    note: '',
                    date: null,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                  },
                ],
              }),
            ]}
            onRequestEditPolicy={vi.fn()}
            onDealPreview={onDealPreview}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Номер полиса')).toBeInTheDocument();
    expect(screen.getByText('Основные данные')).toBeInTheDocument();
    expect(screen.getByText('Платеж')).toBeInTheDocument();
    expect(screen.getByText('Финансовые записи')).toBeInTheDocument();
    expect(screen.queryByText('Оплачено / План')).toBeNull();
    expect(screen.getByText('Начало').className).toContain('w-[6%]');
    expect(screen.getByText('Конец').className).toContain('w-[6%]');

    const statusBadge = screen.getByTitle(
      'Есть финансовые записи без даты оплаты по платежам полиса',
    );
    expect(statusBadge).toHaveTextContent('Есть неоплаченные записи');

    const numberCell = screen.getByText('POL-1').closest('td');
    expect(numberCell).not.toBeNull();
    expect(numberCell?.getAttribute('rowspan')).toBe('2');

    const paidPaymentRow = screen.getByTitle(
      (title) => title.includes('25.02.2025') && title.includes('3'),
    );
    const unpaidPaymentRow = screen.getByTitle(
      (title) => title.includes('без плановой даты') && title.includes('₽'),
    );
    expect(paidPaymentRow.className).toContain('bg-emerald-50');
    expect(unpaidPaymentRow.className).toContain('bg-rose-50');

    const paidRecordRow = screen.getByTitle(
      (title) => title.includes('03.01.2025') && title.includes('Чаевые'),
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
    expect(onDealPreview).toHaveBeenCalledWith('deal-1');

    await waitFor(() => {
      expect(fetchPoliciesKPI).toHaveBeenCalled();
    });
  });

  it('keeps KPI refresh and filter wiring for computed status', async () => {
    const onRefreshPoliciesList = vi.fn().mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView
            policies={[buildPolicy({ computedStatus: 'active' })]}
            payments={[buildPayment({ actualDate: '2025-01-01' })]}
            onRequestEditPolicy={vi.fn()}
            onRefreshPoliciesList={onRefreshPoliciesList}
          />
        </NotificationProvider>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(fetchPoliciesKPI).toHaveBeenCalled();
      expect(onRefreshPoliciesList).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Вычисляемый статус'), {
      target: { value: 'problem' },
    });

    await waitFor(() => {
      expect(onRefreshPoliciesList).toHaveBeenLastCalledWith(
        expect.objectContaining({ computed_status: 'problem' }),
      );
    });
  });

  it('shows empty state when no policies', async () => {
    render(
      <MemoryRouter>
        <NotificationProvider>
          <PoliciesView policies={[]} payments={[]} onRequestEditPolicy={vi.fn()} />
        </NotificationProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Нет полисов для отображения')).toBeInTheDocument();
    await waitFor(() => {
      expect(fetchPoliciesKPI).toHaveBeenCalled();
    });
  });
});
